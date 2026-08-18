"""Testes da integração de IA sem chamadas externas."""

import json
import uuid
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.api.v1.endpoints.professor import generate_theme
from app.db.models.essay import EssayStatus, EssayType
from app.db.models.user import UserPlan
from app.schemas.tarefa import GenerateThemeRequest
from app.services.ai.correction_service import CorrectionService
from app.services.ai.simulado_service import SimuladoService


class FakeResponses:
    def __init__(self, output_text: str, status: str = "completed") -> None:
        self.output_text = output_text
        self.status = status
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            status=self.status,
            output_text=self.output_text,
            usage=SimpleNamespace(input_tokens=100, output_tokens=200),
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
            "feedback": "Avaliacao detalhada.",
            "strengths": [],
            "improvements": [],
        }
        for number in range(1, 6)
    ],
    "highlights": [
        {"start": 0, "end": 5, "text": "Texto", "type": "positive", "comment": "Bom."}
    ],
    "insights": {"general_feedback": "Bom desenvolvimento."},
}


@pytest.mark.parametrize(
    ("plan", "is_assignment", "expected_model"),
    [
        (UserPlan.FREE, False, settings.OPENAI_FREE_MODEL),
        (UserPlan.STANDARD, False, settings.OPENAI_PAID_MODEL),
        (UserPlan.PRO, False, settings.OPENAI_PAID_MODEL),
        (UserPlan.FREE, True, settings.OPENAI_PAID_MODEL),
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
    assert request["text"] == {"format": {"type": "json_object"}}
    assert len(request["safety_identifier"]) == 64
    assert correction.ai_model_used == expected_model
    assert essay.status == EssayStatus.COMPLETED
    assert db.added == [correction]


async def test_free_plan_removes_highlights_from_saved_correction():
    client = FakeClient(json.dumps(CORRECTION_PAYLOAD))

    correction = await CorrectionService(client=client).correct_essay(
        essay=make_essay(),
        user=make_user(UserPlan.FREE),
        db=FakeDb(),
    )

    assert correction.highlights == []


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
    assert essay.error_message == "Serviço de IA temporariamente indisponível"


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
    payload = [
        {
            "theme": f"Tema {index}",
            "prompt": "Proposta",
            "motivating_texts": ["Texto motivador"],
            "time_suggested_minutes": 60,
        }
        for index in range(5)
    ]
    client = FakeClient(json.dumps(payload))

    simulados = await SimuladoService(client=client)._generate_batch("enem")

    request = client.responses.calls[0]
    assert request["model"] == settings.OPENAI_FREE_MODEL
    assert request["store"] is False
    assert len(simulados) == 5
    assert all(item["essay_type"] == "enem" for item in simulados)


async def test_teacher_theme_generation_uses_free_model(monkeypatch):
    payload = {
        "theme": "Desafios da educação digital no Brasil",
        "motivating_texts": [
            {"title": "Texto 1", "content": "Conteúdo 1"},
            {"title": "Texto 2", "content": "Conteúdo 2"},
        ],
    }
    client = FakeClient(json.dumps(payload))
    monkeypatch.setattr("openai.AsyncOpenAI", lambda **kwargs: client)

    class AllowingRedis:
        async def eval(self, *args):
            return [1, 1]

    result = await generate_theme(
        data=GenerateThemeRequest(essay_type="enem"),
        teacher=SimpleNamespace(id=uuid.uuid4()),
        redis_client=AllowingRedis(),
    )

    request = client.responses.calls[0]
    assert request["model"] == settings.OPENAI_FREE_MODEL
    assert request["store"] is False
    assert request["text"] == {"format": {"type": "json_object"}}
    assert result.theme == payload["theme"]
    assert len(result.motivating_texts) == 2
