"""
correction_service.py — Serviço de correção de redações com Claude

Responsável por:
1. Montar o prompt correto baseado no tipo de redação
2. Chamar a Claude API
3. Parsear a resposta JSON
4. Salvar o resultado no banco
"""
import json
import time

import anthropic
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
    Serviço que gerencia a correção de redações usando a Claude API.

    Usa o cliente assíncrono da Anthropic para não bloquear
    o servidor enquanto aguarda a resposta da IA.
    """

    def __init__(self) -> None:
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY
        )

    async def correct_essay(
        self,
        essay: Essay,
        user: User,
        db: AsyncSession,
    ) -> Correction:
        """
        Corrige uma redação e salva o resultado no banco.

        Processo:
        1. Seleciona o prompt correto (ENEM ou Vestibular)
        2. Chama a Claude API
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

            # Chama a Claude API
            logger.info(
                "iniciando_correcao_ia",
                essay_id=str(essay.id),
                essay_type=essay.essay_type.value,
                model=settings.ANTHROPIC_MODEL,
            )

            response = await self.client.messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=settings.ANTHROPIC_MAX_TOKENS,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_message}
                ],
            )

            # Extrai o texto da resposta
            response_text = response.content[0].text

            # Parseia o JSON (Claude retorna JSON puro conforme instruído)
            correction_data = self._parse_correction_response(response_text)

            processing_time = time.perf_counter() - start_time

            # Ajusta detalhe baseado no plano
            highlights = correction_data.get("highlights", [])
            if user.plan.value == "free":
                highlights = []  # Plano free não tem grifes

            # Cria o registro de correção no banco
            correction = Correction(
                essay_id=essay.id,
                user_id=user.id,
                total_score=float(correction_data.get("total_score", 0)),
                max_score=max_score,
                competencies=correction_data.get("competencies", []),
                highlights=highlights,
                insights=correction_data.get("insights", {}),
                ai_model_used=settings.ANTHROPIC_MODEL,
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
            )

            return correction

        except json.JSONDecodeError as e:
            logger.error("erro_parse_resposta_ia", essay_id=str(essay.id), error=str(e))
            essay.status = EssayStatus.ERROR
            essay.error_message = "Erro ao processar resposta da IA"
            raise

        except anthropic.APIError as e:
            logger.error("erro_api_anthropic", essay_id=str(essay.id), error=str(e))
            essay.status = EssayStatus.ERROR
            essay.error_message = "Serviço de IA temporariamente indisponível"
            raise

        except Exception as e:
            logger.error("erro_inesperado_correcao", essay_id=str(essay.id), error=str(e))
            essay.status = EssayStatus.ERROR
            essay.error_message = "Erro inesperado durante a correção"
            raise

    def _parse_correction_response(self, response_text: str) -> dict:
        """
        Parseia a resposta JSON da Claude.

        A Claude pode retornar o JSON com ou sem markdown code blocks.
        Esta função lida com ambos os casos.
        """
        text = response_text.strip()

        # Remove markdown code blocks se presentes
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove primeira linha (```json) e última linha (```)
            text = "\n".join(lines[1:-1])

        data = json.loads(text)

        # Validações básicas da estrutura
        required_fields = ["total_score", "competencies", "highlights", "insights"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Campo obrigatório ausente na resposta da IA: {field}")

        # Garante que competencies é uma lista
        if not isinstance(data["competencies"], list):
            raise ValueError("Campo 'competencies' deve ser uma lista")

        return data
