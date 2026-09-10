"""Fábrica única do cliente OpenAI usado exclusivamente no backend."""

from openai import AsyncOpenAI

from app.core.config import settings


def create_openai_client(*, max_retries: int | None = None) -> AsyncOpenAI:
    """Cria o cliente com timeout centralizado e falha cedo sem credencial."""
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY não configurada")

    return AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
        max_retries=settings.OPENAI_MAX_RETRIES if max_retries is None else max_retries,
    )
