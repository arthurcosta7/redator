"""
correction_service.py — Serviço de correção de redações com OpenAI

Responsável por:
1. Montar o prompt correto baseado no tipo de redação
2. Chamar a Responses API da OpenAI
3. Parsear a resposta JSON
4. Ajustar o nível de detalhe baseado no plano do usuário
5. Salvar o resultado no banco
"""
import hashlib
import json
import math
import re
import time

import bleach
import openai
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.db.models.correction import Correction
from app.db.models.essay import Essay, EssayStatus, EssayType
from app.db.models.user import User
from app.services.ai.prompts.enem_prompt import (
    ENEM_SYSTEM_PROMPT,
    build_enem_correction_prompt,
)
from app.services.ai.prompts.vestibular_prompt import (
    VESTIBULAR_SYSTEM_PROMPT,
    build_vestibular_correction_prompt,
)

logger = get_logger(__name__)


class CorrectionService:
    """
    Serviço que gerencia a correção de redações usando a OpenAI.

    O plano gratuito usa GPT-5.6 Luna; Standard, Pro e tarefas usam
    GPT-5.4 mini.
    """

    def __init__(self, client: AsyncOpenAI | None = None) -> None:
        self.client = client or AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.OPENAI_TIMEOUT_SECONDS,
            max_retries=settings.OPENAI_MAX_RETRIES,
        )

    async def correct_essay(
        self,
        essay: Essay,
        user: User,
        db: AsyncSession,
        is_assignment: bool = False,
    ) -> Correction:
        """
        Corrige uma redação e salva o resultado no banco.

        Processo:
        1. Seleciona o prompt correto (ENEM ou Vestibular)
        2. Chama a Responses API da OpenAI
        3. Parseia o JSON retornado
        4. Ajusta o nível de detalhe baseado no plano do usuário
        5. Salva no banco
        """
        start_time = time.perf_counter()

        try:
            # Seleciona prompts baseado no tipo de redação
            if essay.essay_type == EssayType.ENEM:
                system_prompt = ENEM_SYSTEM_PROMPT
                user_message = build_enem_correction_prompt(
                    essay_content=essay.content,
                    theme=essay.theme,
                )
                max_score = 1000.0
            else:
                system_prompt = VESTIBULAR_SYSTEM_PROMPT
                user_message = build_vestibular_correction_prompt(
                    essay_content=essay.content,
                    theme=essay.theme,
                )
                max_score = 100.0

            # Tarefas usam o modelo pago; redações individuais respeitam o plano.
            model = (
                settings.OPENAI_PAID_MODEL
                if is_assignment or user.plan.value != "free"
                else settings.OPENAI_FREE_MODEL
            )

            logger.info(
                "iniciando_correcao_ia",
                essay_id=str(essay.id),
                essay_type=essay.essay_type.value,
                model=model,
            )

            response = await self.client.responses.create(
                model=model,
                max_output_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
                reasoning={"effort": "none"},
                safety_identifier=hashlib.sha256(str(user.id).encode()).hexdigest(),
                store=False,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                text={"format": {"type": "json_object"}},
            )

            if response.status == "incomplete":
                raise ValueError("Resposta da IA incompleta")

            response_text = response.output_text

            # Parseia o JSON
            correction_data = self._parse_correction_response(response_text, essay.essay_type)

            processing_time = time.perf_counter() - start_time

            # Ajusta detalhe baseado no plano
            highlights = correction_data.get("highlights", [])
            if user.plan.value == "free":
                highlights = []  # Plano Free não tem grifes

            # Cria o registro de correção no banco
            correction = Correction(
                essay_id=essay.id,
                user_id=user.id,
                total_score=float(correction_data.get("total_score", 0)),
                max_score=max_score,
                competencies=correction_data.get("competencies", []),
                highlights=highlights,
                insights=correction_data.get("insights", {}),
                ai_model_used=model,
                processing_time_seconds=round(processing_time, 2),
            )

            db.add(correction)
            essay.status = EssayStatus.COMPLETED

            logger.info(
                "correcao_concluida",
                essay_id=str(essay.id),
                score=correction.total_score,
                max_score=max_score,
                processing_time=round(processing_time, 2),
                input_tokens=response.usage.input_tokens if response.usage else 0,
                output_tokens=response.usage.output_tokens if response.usage else 0,
            )

            return correction

        except json.JSONDecodeError as e:
            logger.error("erro_parse_resposta_ia", essay_id=str(essay.id), error=str(e))
            essay.status = EssayStatus.ERROR
            essay.error_message = "Erro ao processar resposta da IA"
            raise

        except openai.APIStatusError as e:
            logger.error(
                "erro_api_openai",
                essay_id=str(essay.id),
                status_code=e.status_code,
                error=str(e),
            )
            essay.status = EssayStatus.ERROR
            essay.error_message = "Serviço de IA temporariamente indisponível"
            raise

        except Exception as e:
            logger.error(
                "erro_correcao_ia",
                essay_id=str(essay.id),
                error=str(e),
                error_type=type(e).__name__,
            )
            essay.status = EssayStatus.ERROR
            essay.error_message = "Serviço de IA temporariamente indisponível"
            raise

    def _parse_correction_response(
        self, response_text: str, essay_type: EssayType
    ) -> dict:
        """
        Parseia e valida a resposta JSON da OpenAI.
        """
        text = response_text.strip()

        # Remove markdown code blocks se presentes (fallback de segurança)
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove primeira linha (```json) e última (```)
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        data = json.loads(
            text,
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"Numero JSON nao finito: {value}")
            ),
        )

        if not isinstance(data, dict):
            raise ValueError("Resposta da IA deve ser um objeto JSON")

        # Validações básicas da estrutura
        required_fields = ["total_score", "competencies", "highlights", "insights"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Campo obrigatório ausente na resposta da IA: {field}")

        self._validate_scores(data, essay_type)

        if not isinstance(data["highlights"], list):
            data["highlights"] = []  # Garante lista mesmo se IA retornar null

        if not isinstance(data["insights"], dict):
            raise ValueError("Campo 'insights' deve ser um objeto")

        return self._sanitize_ai_output(data)

    @staticmethod
    def _validate_scores(data: dict, essay_type: EssayType) -> None:
        """Trata a resposta do modelo como entrada nao confiavel."""
        if essay_type == EssayType.ENEM:
            expected_count = 5
            expected_max = 200.0
            allowed_scores = {0.0, 40.0, 80.0, 120.0, 160.0, 200.0}
            max_total = 1000.0
        else:
            expected_count = 4
            expected_max = 25.0
            allowed_scores = {0.0, 5.0, 10.0, 15.0, 20.0, 25.0}
            max_total = 100.0

        competencies = data.get("competencies")
        if not isinstance(competencies, list) or len(competencies) != expected_count:
            raise ValueError(f"A correcao deve conter {expected_count} competencias")

        total_score = data.get("total_score")
        if (
            isinstance(total_score, bool)
            or not isinstance(total_score, (int, float))
            or not math.isfinite(float(total_score))
            or not 0 <= float(total_score) <= max_total
        ):
            raise ValueError("Nota total invalida na resposta da IA")

        seen_numbers: set[int] = set()
        calculated_total = 0.0
        required_keys = {
            "number", "name", "score", "max_score", "feedback", "strengths", "improvements"
        }
        for competency in competencies:
            if not isinstance(competency, dict) or not required_keys.issubset(competency):
                raise ValueError("Competencia incompleta na resposta da IA")
            number = competency["number"]
            score = competency["score"]
            max_score = competency["max_score"]
            if isinstance(number, bool) or not isinstance(number, int):
                raise ValueError("Numero de competencia invalido")
            if number in seen_numbers or not 1 <= number <= expected_count:
                raise ValueError("Competencias duplicadas ou fora da faixa")
            if (
                isinstance(score, bool)
                or not isinstance(score, (int, float))
                or not math.isfinite(float(score))
                or float(score) not in allowed_scores
            ):
                raise ValueError(f"Nota invalida na competencia {number}")
            if max_score != expected_max:
                raise ValueError(f"Nota maxima invalida na competencia {number}")
            if not isinstance(competency["name"], str) or not isinstance(
                competency["feedback"], str
            ):
                raise ValueError("Textos da competencia sao invalidos")
            if not isinstance(competency["strengths"], list) or not isinstance(
                competency["improvements"], list
            ):
                raise ValueError("Listas da competencia sao invalidas")
            seen_numbers.add(number)
            calculated_total += float(score)

        if seen_numbers != set(range(1, expected_count + 1)):
            raise ValueError("Conjunto de competencias incompleto")
        if abs(calculated_total - float(total_score)) > 0.01:
            raise ValueError("Nota total difere da soma das competencias")

    @classmethod
    def _sanitize_ai_output(cls, value):
        """Remove HTML e controles de qualquer texto devolvido pelo modelo."""
        if isinstance(value, str):
            cleaned = bleach.clean(value, tags=[], strip=True)
            return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", cleaned)
        if isinstance(value, list):
            return [cls._sanitize_ai_output(item) for item in value]
        if isinstance(value, dict):
            return {key: cls._sanitize_ai_output(item) for key, item in value.items()}
        return value
