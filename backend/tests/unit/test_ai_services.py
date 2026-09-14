"""Testes da integração de IA sem chamadas externas."""

import json
import uuid
from types import SimpleNamespace

import pytest

from app.api.v1.endpoints.professor import generate_theme
from app.core.config import settings
from app.db.models.essay import EssayStatus, EssayType
from app.db.models.user import UserPlan
from app.schemas.tarefa import GenerateThemeRequest
from app.services.ai.correction_service import CorrectionService
from app.services.ai.simulado_service import MotivatingText, SimuladoService


class FakeResponses:
    def __init__(self, output_text: str, status: str = "completed") -> None:
        self.output_text = output_text
        self.status = status
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            id="resp_test_123",
            status=self.status,
            output_text=self.output_text,
            usage=SimpleNamespace(
                input_tokens=100,
                input_tokens_details=SimpleNamespace(cached_tokens=60),
                output_tokens=200,
                total_tokens=300,
            ),
        )


class FakeClient:
    def __init__(self, output_text: str, status: str = "completed") -> None:
        self.responses = FakeResponses(output_text, status)


class FakeDb:
    def __init__(self) -> None:
        self.added: list = []

    def add(self, instance) -> None:
        self.added.append(instance)


def make_essay():
    return SimpleNamespace(
        id=uuid.uuid4(),
        essay_type=EssayType.ENEM,
        content="Texto de redação para teste com argumentos e proposta de intervenção.",
        theme="Educação no Brasil",
        status=EssayStatus.PROCESSING,
        error_message=None,
    )


def make_user(plan: UserPlan):
    return SimpleNamespace(id=uuid.uuid4(), plan=plan)


CORRECTION_PAYLOAD = {
    "total_score": 800,
    "competencies": [
        {
            "number": number,
            "name": f"Competencia {number}",
            "score": 160,
            "max_score": 200,
            "feedback": (
                "O texto mantém o foco no tema e organiza a ideia central com clareza, "
                "mas ainda precisa aprofundar a relação entre a evidência apresentada "
                "e a conclusão defendida para alcançar a faixa seguinte da competência."
            ),
            "strengths": ["A tese aparece de forma explícita na introdução."],
            "improvements": ["Explique como o exemplo comprova o argumento central."],
        }
        for number in range(1, 6)
    ],
    "highlights": [{"start": 0, "end": 5, "text": "Texto", "type": "positive", "comment": "Bom."}],
    "insights": {
        "general_feedback": (
            "A redação apresenta tese compreensível, progressão lógica e uma proposta "
            "relacionada ao problema. Para avançar, precisa aprofundar as relações de "
            "causa e consequência e tornar cada etapa da intervenção mais específica."
        ),
        "main_strengths": [
            {
                "title": "Tese claramente delimitada",
                "evidence": "O problema exige ação conjunta do Estado e da sociedade.",
                "explanation": (
                    "O trecho responde diretamente ao recorte temático e antecipa os "
                    "dois eixos que serão desenvolvidos ao longo da argumentação."
                ),
                "repeat_strategy": (
                    "Continue encerrando a introdução com uma tese que nomeie o problema "
                    "e indique, em ordem, os eixos desenvolvidos nos parágrafos seguintes."
                ),
            }
        ],
        "priority_improvements": [
            {
                "title": "Aprofundar o nexo causal",
                "evidence": "A falta de educação prejudica a sociedade.",
                "impact": (
                    "A afirmação é ampla e não demonstra o mecanismo pelo qual a causa "
                    "produz o efeito, o que limita a força do argumento."
                ),
                "how_to_improve": (
                    "Nomeie o grupo afetado, descreva o processo intermediário e conecte "
                    "essa consequência à tese antes de apresentar outro argumento."
                ),
                "rewrite_example": (
                    "Sem formação midiática, estudantes têm mais dificuldade para verificar "
                    "fontes, o que amplia a circulação de desinformação no ambiente escolar."
                ),
                "practice": (
                    "Reescreva dois argumentos usando a sequência causa, mecanismo e consequência."
                ),
            }
        ],
        "next_essay_checklist": [
            "Confirmar se cada parágrafo desenvolve apenas um eixo da tese.",
            "Revisar se a proposta apresenta agente, ação, meio e finalidade.",
        ],
        "writing_level": "intermediário",
    },
    "is_zero": False,
    "zero_reason": None,
}


@pytest.mark.parametrize(
    ("plan", "is_assignment", "expected_model"),
    [
        (UserPlan.FREE, False, settings.OPENAI_CORRECTION_MODEL),
        (UserPlan.STANDARD, False, settings.OPENAI_CORRECTION_MODEL),
        (UserPlan.PRO, False, settings.OPENAI_CORRECTION_MODEL),
        (UserPlan.FREE, True, settings.OPENAI_CORRECTION_MODEL),
    ],
)
async def test_correction_routes_model_by_plan(plan, is_assignment, expected_model):
    client = FakeClient(json.dumps(CORRECTION_PAYLOAD))
    db = FakeDb()
    essay = make_essay()

    correction = await CorrectionService(client=client).correct_essay(
        essay=essay,
        user=make_user(plan),
        db=db,
        is_assignment=is_assignment,
    )

    request = client.responses.calls[0]
    assert request["model"] == expected_model
    assert request["store"] is False
    assert request["reasoning"] == {"effort": "none"}
    assert request["text"]["format"]["type"] == "json_schema"
    assert request["text"]["format"]["strict"] is True
    assert request["prompt_cache_key"].startswith("essay-correction:enem:")
    assert request["input"][0]["role"] == "developer"
    assert request["input"][1]["role"] == "user"
    assert len(request["safety_identifier"]) == 64
    assert correction.ai_model_used == expected_model
    assert correction.prompt_version == settings.ESSAY_CORRECTION_PROMPT_VERSION
    assert correction.openai_response_id == "resp_test_123"
    assert correction.cached_input_tokens == 60
    assert essay.status == EssayStatus.COMPLETED
    assert db.added == [correction]


async def test_free_plan_preserves_highlights_for_controlled_response():
    client = FakeClient(json.dumps(CORRECTION_PAYLOAD))

    correction = await CorrectionService(client=client).correct_essay(
        essay=make_essay(),
        user=make_user(UserPlan.FREE),
        db=FakeDb(),
    )

    assert correction.highlights == CORRECTION_PAYLOAD["highlights"]


async def test_incomplete_correction_marks_essay_as_error():
    client = FakeClient("", status="incomplete")
    essay = make_essay()

    with pytest.raises(ValueError, match="incompleta"):
        await CorrectionService(client=client).correct_essay(
            essay=essay,
            user=make_user(UserPlan.STANDARD),
            db=FakeDb(),
        )

    assert essay.status == EssayStatus.ERROR
    assert essay.error_message == "Erro ao processar resposta da IA"


@pytest.mark.parametrize(
    "payload",
    [
        {**CORRECTION_PAYLOAD, "total_score": 1200},
        {**CORRECTION_PAYLOAD, "total_score": float("nan")},
        {
            **CORRECTION_PAYLOAD,
            "total_score": 840,
            "competencies": CORRECTION_PAYLOAD["competencies"],
        },
        {
            **CORRECTION_PAYLOAD,
            "competencies": [
                *CORRECTION_PAYLOAD["competencies"][:4],
                {**CORRECTION_PAYLOAD["competencies"][3], "number": 4},
            ],
        },
    ],
)
async def test_untrusted_ai_scores_are_rejected(payload):
    essay = make_essay()
    client = FakeClient(json.dumps(payload))

    with pytest.raises(ValueError):
        await CorrectionService(client=client).correct_essay(
            essay=essay,
            user=make_user(UserPlan.STANDARD),
            db=FakeDb(),
        )
    assert essay.status == EssayStatus.ERROR


async def test_simulado_uses_free_model_and_parses_batch():
    motivating_content = " ".join(
        ["Conteúdo aprofundado e verificável para apoiar a reflexão crítica do candidato."] * 8
    )
    payload = {
        "simulados": [
            {
                "theme": f"Desafios sociais brasileiros em debate {index}",
                "prompt": " ".join(
                    ["Redija um texto dissertativo-argumentativo com posicionamento claro e argumentos articulados."] * 4
                ),
                "motivating_texts": [
                    {
                        "title": f"Perspectiva {source_index}",
                        "content": motivating_content,
                        "source_name": f"Fonte institucional {source_index}",
                        "source_url": f"https://www.gov.br/inep/fonte-{index}-{source_index}",
                        "source_date": "2026-09-13",
                        "material_type": "research",
                    }
                    for source_index in range(4)
                ],
                "time_suggested_minutes": 60,
            }
            for index in range(3)
        ]
    }
    client = FakeClient(json.dumps(payload))

    simulados = await SimuladoService(client=client)._generate_batch("enem")

    request = client.responses.calls[0]
    assert request["model"] == settings.OPENAI_FREE_MODEL
    assert request["store"] is False
    assert request["tool_choice"] == "required"
    assert request["tools"][0]["type"] == "web_search"
    assert request["reasoning"] == {"effort": "low"}
    assert "quatro fontes diferentes" in request["input"][0]["content"]
    assert request["text"]["format"]["type"] == "json_schema"
    assert len(simulados) == 3
    assert all(item["essay_type"] == "enem" for item in simulados)
    assert all(len(item["motivating_texts"]) == 4 for item in simulados)
    assert simulados[0]["motivating_texts"][0]["source_url"].startswith("https://www.gov.br/")


@pytest.mark.parametrize(
    ("content", "source_url"),
    [
        ("Texto raso.", "https://www.gov.br/inep/fonte"),
        (" ".join(["Conteúdo verificável e aprofundado."] * 25), "https://example.com/fonte"),
    ],
)
def test_simulado_rejects_shallow_or_untrusted_motivating_text(content, source_url):
    with pytest.raises(ValueError):
        MotivatingText(
            title="Uma perspectiva relevante",
            content=content,
            source_name="Fonte institucional",
            source_url=source_url,
            source_date=None,
            material_type="research",
        )


async def test_teacher_theme_generation_uses_free_model(monkeypatch):
    payload = {
        "theme": "Desafios da educação digital no Brasil",
        "motivating_texts": [
            {"title": "Texto 1", "content": "Conteúdo 1"},
            {"title": "Texto 2", "content": "Conteúdo 2"},
        ],
    }
    client = FakeClient(json.dumps(payload))
    monkeypatch.setattr("app.api.v1.endpoints.professor.create_openai_client", lambda: client)

    class AllowingRedis:
        async def eval(self, *args):
            return [1, 1]

    result = await generate_theme(
        data=GenerateThemeRequest(essay_type="enem"),
        teacher=SimpleNamespace(
            id=uuid.uuid4(), teacher_student_slots=30,
            user_type=SimpleNamespace(value="teacher"),
        ),
        redis_client=AllowingRedis(),
    )

    request = client.responses.calls[0]
    assert request["model"] == settings.OPENAI_FREE_MODEL
    assert request["store"] is False
    assert request["text"] == {"format": {"type": "json_object"}}
    assert result.theme == payload["theme"]
    assert len(result.motivating_texts) == 2
