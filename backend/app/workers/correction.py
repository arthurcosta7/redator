"""Worker ARQ que processa correções com concorrência e tentativas limitadas."""
from typing import Any, ClassVar
from uuid import UUID

from arq import Retry
from sqlalchemy import select

from app.core.config import settings
from app.core.job_queue import get_arq_redis_settings
from app.core.logging import get_logger
from app.core.rate_limiter import release_daily_correction_slot
from app.db.models.correction import Correction
from app.db.models.essay import Essay, EssayStatus
from app.db.models.user import User
from app.db.session import AsyncSessionLocal
from app.services.ai.correction_service import CorrectionService, TransientAIError

logger = get_logger(__name__)


async def process_correction(
    ctx: dict[str, Any],
    essay_id: str,
    is_assignment: bool = False,
) -> dict[str, str]:
    """Corrige uma redação de modo idempotente e recuperável após falhas."""
    essay_uuid = UUID(essay_id)

    async with AsyncSessionLocal() as db:
        # O lock mantém a leitura e a mudança inicial de estado na mesma seção
        # crítica. A consulta de Correction evita reprocessar casos concluídos.
        essay = await db.scalar(select(Essay).where(Essay.id == essay_uuid).with_for_update())
        if essay is None:
            logger.warning("correcao_redacao_inexistente", essay_id=essay_id)
            return {"status": "not_found"}

        existing = await db.scalar(select(Correction).where(Correction.essay_id == essay_uuid))
        if existing is not None or essay.status == EssayStatus.COMPLETED:
            essay.status = EssayStatus.COMPLETED
            await db.commit()
            return {"status": "already_completed"}

        user = await db.get(User, essay.user_id)
        if user is None:
            essay.status = EssayStatus.ERROR
            essay.error_message = "Usuário da redação não foi encontrado."
            await db.commit()
            return {"status": "user_not_found"}

        essay.status = EssayStatus.PROCESSING
        essay.error_message = None
        await db.commit()

        try:
            await CorrectionService().correct_essay(
                essay=essay,
                user=user,
                db=db,
                is_assignment=is_assignment,
            )
            await db.commit()
            return {"status": "completed"}
        except Exception as exc:
            # O rollback remove qualquer escrita parcial do provedor antes de
            # reagendar o job; cada tentativa recomeça a partir do banco.
            await db.rollback()
            job_try = int(ctx.get("job_try", 1))
            # Só falhas transitórias são repetidas; erros permanentes não
            # devem gerar uma segunda cobrança.
            if (
                isinstance(exc, TransientAIError)
                and job_try < settings.CORRECTION_JOB_MAX_TRIES
            ):
                logger.warning(
                    "correcao_reagendada",
                    essay_id=essay_id,
                    attempt=job_try,
                    error_type=type(exc).__name__,
                )
                raise Retry(defer=10 * job_try) from exc

            essay = await db.get(Essay, essay_uuid)
            if essay is not None:
                essay.status = EssayStatus.ERROR
                essay.error_message = "Erro ao processar correção. Tente novamente."
                await db.commit()
                # Entregas de tarefas pertencem à cota do professor. Somente a
                # correção avulsa reservou um slot diário do aluno para devolver.
                if not is_assignment:
                    await release_daily_correction_slot(str(essay.user_id), ctx["redis"])
            logger.error(
                "correcao_falhou_definitivamente",
                essay_id=essay_id,
                attempts=job_try,
                error_type=type(exc).__name__,
            )
            return {"status": "error"}


class WorkerSettings:
    functions: ClassVar[list[Any]] = [process_correction]
    redis_settings = get_arq_redis_settings()
    queue_name = "arq:queue:corrections"
    max_jobs = settings.CORRECTION_WORKER_MAX_JOBS
    job_timeout = settings.CORRECTION_JOB_TIMEOUT_SECONDS
    max_tries = settings.CORRECTION_JOB_MAX_TRIES
    keep_result = 3600
    health_check_interval = 30
    health_check_key = "arq:health:corrections"
