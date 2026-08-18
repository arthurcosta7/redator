"""Cliente da fila Redis usada para desacoplar tarefas caras das requisições HTTP."""
from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import settings

_job_queue: ArqRedis | None = None


def get_arq_redis_settings() -> RedisSettings:
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    redis_settings.conn_timeout = settings.REDIS_CONNECT_TIMEOUT_SECONDS
    redis_settings.max_connections = settings.REDIS_MAX_CONNECTIONS
    return redis_settings


async def get_job_queue() -> ArqRedis:
    global _job_queue
    if _job_queue is None:
        _job_queue = await create_pool(
            get_arq_redis_settings(),
            default_queue_name="arq:queue:corrections",
        )
    return _job_queue


async def enqueue_correction(essay_id: str, is_assignment: bool = False) -> None:
    """Enfileira exatamente um job por redação enquanto o ID estiver no Redis."""
    queue = await get_job_queue()
    job = await queue.enqueue_job(
        "process_correction",
        essay_id,
        is_assignment,
        _job_id=f"correction:{essay_id}",
        _expires=settings.CORRECTION_JOB_EXPIRES_SECONDS,
        _queue_name="arq:queue:corrections",
    )
    if job is None:
        raise RuntimeError("A correção já está enfileirada")


async def close_job_queue() -> None:
    global _job_queue
    if _job_queue is not None:
        await _job_queue.aclose()
        _job_queue = None
