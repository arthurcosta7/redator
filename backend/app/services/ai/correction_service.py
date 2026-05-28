"""
correction_service.py — Serviço de correção de redações com Claude (Anthropic)

Responsável por:
1. Montar o prompt correto baseado no tipo de redação
2. Chamar a API Claude (claude-sonnet-4-6)
3. Parsear a resposta JSON
4. Ajustar o nível de detalhe baseado no plano do usuário
5. Salvar o resultado no banco
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
    Serviço que gerencia a correção de redações usando Claude (Anthropic).

    Claude Sonnet 4.6 oferece:
    - Análise textual profunda em português brasileiro
    - Seguimento fiel de instruções de formato JSON
    - Feedback construtivo e detalhado
    - Custo equilibrado para uso em produção
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
        is_assignment: bool = False,
    ) -> Correction:
        """
        Corrige uma redação e salva o resultado no banco.

        Processo:
        1. Seleciona o prompt correto (ENEM ou Vestibular)
        2. Chama a API Claude
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

            # Tarefas sempre usam Sonnet (professor paga); Free usa Haiku
            model = (
                settings.ANTHROPIC_MODEL
                if is_assignment or user.plan.value != "free"
                else "claude-haiku-4-5-20251001"
            )

            logger.info(
                "iniciando_correcao_ia",
                essay_id=str(essay.id),
                essay_type=essay.essay_type.value,
                model=model,
            )

            # Chama a API Claude
            # Nota: Claude segue instruções de formato JSON com alta fidelidade.
            # Usamos temperature baixa para respostas consistentes e precisas.
            response = await self.client.messages.create(
                model=model,
                max_tokens=settings.ANTHROPIC_MAX_TOKENS,
                temperature=0.3,   # Baixa temperatura → consistência e precisão
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_message},
                ],
            )

            # Extrai o texto da resposta Claude
            response_text = response.content[0].text if response.content else ""

            # Parseia o JSON
            correction_data = self._parse_correction_response(response_text)

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
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
            )

            return correction

        except json.JSONDecodeError as e:
            logger.error("erro_parse_resposta_ia", essay_id=str(essay.id), error=str(e))
            essay.status = EssayStatus.ERROR
            essay.error_message = "Erro ao processar resposta da IA"
            raise

        except anthropic.APIStatusError as e:
            logger.error(
                "erro_api_claude",
                essay_id=str(essay.id),
                status_code=e.status_code,
                error=str(e.message),
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

    def _parse_correction_response(self, response_text: str) -> dict:
        """
        Parseia a resposta JSON do Claude.

        Claude é altamente fiel ao formato JSON solicitado no prompt,
        mas fazemos validações de segurança mesmo assim.
        """
        text = response_text.strip()

        # Remove markdown code blocks se presentes (fallback de segurança)
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove primeira linha (```json) e última (```)
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        data = json.loads(text)

        # Validações básicas da estrutura
        required_fields = ["total_score", "competencies", "highlights", "insights"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Campo obrigatório ausente na resposta da IA: {field}")

        if not isinstance(data["competencies"], list):
            raise ValueError("Campo 'competencies' deve ser uma lista")

        if not isinstance(data["highlights"], list):
            data["highlights"] = []  # Garante lista mesmo se IA retornar null

        return data
