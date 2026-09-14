"""Serviço de correção de redações com OpenAI e telemetria de custo."""

import hashlib
import json
import math
import re
import time
from decimal import Decimal
from typing import Any, cast

import bleach
import openai
from openai import AsyncOpenAI
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.db.models.correction import Correction
from app.db.models.essay import Essay, EssayStatus, EssayType
from app.db.models.user import User
from app.services.ai.correction_schema import (
    CORRECTION_RESPONSE_FORMAT,
    CorrectionAIResponse,
)
from app.services.ai.openai_client import create_openai_client
from app.services.ai.prompt_builder import build_correction_prompt
from app.services.ai.token_usage import normalize_token_usage

logger = get_logger(__name__)


class InvalidAIResponseError(ValueError):
    """Resposta concluída, mas inválida e que não deve gerar retry pago."""


class TransientAIError(RuntimeError):
    """Falha temporária de rede, limite ou provedor que admite retry."""


class CorrectionService:
    """Corrige, valida e persiste redações sem confiar na saída do modelo."""

    def __init__(self, client: AsyncOpenAI | None = None) -> None:
        # O worker controla retries. Desativá-los na SDK evita multiplicar
        # silenciosamente chamadas pagas dentro de uma tentativa do job.
        self.client = client or create_openai_client(max_retries=0)

    async def correct_essay(
        self,
        essay: Essay,
        user: User,
        db: AsyncSession,
        is_assignment: bool = False,
    ) -> Correction:
        """Executa uma chamada, mede seu custo e prepara a transação no banco."""
        start_time = time.perf_counter()

        try:
            model = settings.OPENAI_CORRECTION_MODEL
            max_score = 1000.0 if essay.essay_type == EssayType.ENEM else 100.0
            prompt = build_correction_prompt(
                essay_type=essay.essay_type,
                essay_content=essay.content,
                theme=essay.theme,
                model=model,
            )

            logger.info(
                "iniciando_correcao_ia",
                essay_id=str(essay.id),
                essay_type=essay.essay_type.value,
                model=model,
                prompt_version=prompt.version,
                is_assignment=is_assignment,
            )

            # O schema é gerado pelo Pydantic em runtime; os casts ficam
            # restritos à fronteira tipada da SDK.
            request_input = cast(
                Any,
                [
                    {"role": "developer", "content": prompt.cacheable_prefix},
                    {"role": "user", "content": prompt.variable_content},
                ],
            )
            response_text_config = cast(
                Any,
                {"format": CORRECTION_RESPONSE_FORMAT, "verbosity": "low"},
            )
            response = await self.client.responses.create(
                model=model,
                max_output_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
                reasoning={"effort": "none"},
                safety_identifier=hashlib.sha256(str(user.id).encode()).hexdigest(),
                store=False,
                # A ordem é deliberada: tudo que se repete vem primeiro; tema e
                # redação ficam por último para preservar o prefixo cacheável.
                input=request_input,
                prompt_cache_key=prompt.cache_key,
                text=response_text_config,
            )

            if response.status == "incomplete":
                raise InvalidAIResponseError("Resposta da IA incompleta")

            correction_data = self._parse_correction_response(
                response.output_text, essay.essay_type
            )
            usage = normalize_token_usage(response.usage)
            processing_time = time.perf_counter() - start_time

            correction = Correction(
                essay_id=essay.id,
                user_id=user.id,
                total_score=float(correction_data["total_score"]),
                max_score=max_score,
                competencies=correction_data["competencies"],
                # O resultado completo é preservado cifrado. A camada de resposta
                # decide quanto mostrar conforme plano e ordem da correção.
                highlights=correction_data["highlights"],
                insights=correction_data["insights"],
                ai_model_used=model,
                prompt_version=prompt.version,
                openai_response_id=getattr(response, "id", None),
                input_tokens=usage.input_tokens,
                cached_input_tokens=usage.cached_input_tokens,
                cache_write_tokens=usage.cache_write_tokens,
                output_tokens=usage.output_tokens,
                total_tokens=usage.total_tokens,
                estimated_cost_usd=usage.estimated_cost_usd,
                cache_hit_ratio=usage.cache_hit_ratio,
                processing_time_seconds=round(processing_time, 2),
            )

            db.add(correction)
            essay.status = EssayStatus.COMPLETED

            logger.info(
                "correcao_concluida",
                essay_id=str(essay.id),
                score=correction.total_score,
                max_score=max_score,
                duration_ms=round(processing_time * 1000),
                request_id=getattr(response, "id", None),
                model=model,
                prompt_version=prompt.version,
                input_tokens=usage.input_tokens,
                cached_input_tokens=usage.cached_input_tokens,
                cache_write_tokens=usage.cache_write_tokens,
                output_tokens=usage.output_tokens,
                total_tokens=usage.total_tokens,
                cache_hit_ratio=str(usage.cache_hit_ratio.quantize(Decimal("0.000001"))),
                estimated_cost_usd=str(usage.estimated_cost_usd.quantize(Decimal("0.00000001"))),
            )
            return correction

        except InvalidAIResponseError as exc:
            logger.error(
                "erro_parse_resposta_ia",
                essay_id=str(essay.id),
                error_type=type(exc).__name__,
            )
            essay.status = EssayStatus.ERROR
            essay.error_message = "Erro ao processar resposta da IA"
            raise

        except (
            openai.APITimeoutError,
            openai.APIConnectionError,
            openai.RateLimitError,
        ) as exc:
            logger.error(
                "erro_transitorio_openai",
                essay_id=str(essay.id),
                error_type=type(exc).__name__,
            )
            essay.status = EssayStatus.ERROR
            essay.error_message = "Serviço de IA temporariamente indisponível"
            raise TransientAIError("Falha temporária da OpenAI") from exc

        except openai.APIStatusError as exc:
            logger.error(
                "erro_api_openai",
                essay_id=str(essay.id),
                status_code=exc.status_code,
                error_type=type(exc).__name__,
            )
            essay.status = EssayStatus.ERROR
            essay.error_message = "Serviço de IA temporariamente indisponível"
            if exc.status_code >= 500:
                raise TransientAIError("Falha temporária da OpenAI") from exc
            raise

        except Exception as exc:
            logger.error(
                "erro_correcao_ia",
                essay_id=str(essay.id),
                error_type=type(exc).__name__,
            )
            essay.status = EssayStatus.ERROR
            essay.error_message = "Serviço de IA temporariamente indisponível"
            raise

    def _parse_correction_response(
        self, response_text: str, essay_type: EssayType
    ) -> dict[str, Any]:
        """Valida schema, regras de pontuação e sanitiza todo texto retornado."""
        text = response_text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        try:
            raw_data = json.loads(
                text,
                parse_constant=lambda value: (_ for _ in ()).throw(
                    ValueError(f"Número JSON não finito: {value}")
                ),
            )
            data = CorrectionAIResponse.model_validate(raw_data).model_dump()
            self._validate_scores(data, essay_type)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            raise InvalidAIResponseError("Resposta estruturada inválida") from exc

        return cast(dict[str, Any], self._sanitize_ai_output(data))

    @staticmethod
    def _validate_scores(data: dict[str, Any], essay_type: EssayType) -> None:
        """Aplica invariantes de negócio além do schema estrutural da API."""
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

        competencies = data["competencies"]
        if len(competencies) != expected_count:
            raise ValueError(f"A correção deve conter {expected_count} competências")

        total_score = data["total_score"]
        if not math.isfinite(total_score) or not 0 <= total_score <= max_total:
            raise ValueError("Nota total inválida na resposta da IA")
        if data["is_zero"] != (total_score == 0):
            raise ValueError("Indicador de nota zero diverge da nota total")
        if data["is_zero"] and not data["zero_reason"]:
            raise ValueError("Motivo obrigatório para nota zero")
        if not data["is_zero"] and data["zero_reason"] is not None:
            raise ValueError("Motivo de nota zero deve ser nulo quando a nota é positiva")

        seen_numbers: set[int] = set()
        calculated_total = 0.0
        for competency in competencies:
            number = competency["number"]
            score = competency["score"]
            if number in seen_numbers or not 1 <= number <= expected_count:
                raise ValueError("Competências duplicadas ou fora da faixa")
            if not math.isfinite(score) or score not in allowed_scores:
                raise ValueError(f"Nota inválida na competência {number}")
            if competency["max_score"] != expected_max:
                raise ValueError(f"Nota máxima inválida na competência {number}")
            seen_numbers.add(number)
            calculated_total += score

        if seen_numbers != set(range(1, expected_count + 1)):
            raise ValueError("Conjunto de competências incompleto")
        if abs(calculated_total - total_score) > 0.01:
            raise ValueError("Nota total difere da soma das competências")

    @classmethod
    def _sanitize_ai_output(cls, value: Any) -> Any:
        """Remove HTML e controles de qualquer texto devolvido pelo modelo."""
        if isinstance(value, str):
            cleaned = bleach.clean(value, tags=[], strip=True)
            return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", cleaned)
        if isinstance(value, list):
            return [cls._sanitize_ai_output(item) for item in value]
        if isinstance(value, dict):
            return {key: cls._sanitize_ai_output(item) for key, item in value.items()}
        return value
