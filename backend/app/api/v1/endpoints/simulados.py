"""
simulados.py — Endpoints de simulados de redação

GET /simulados/new?type=enem|vestibular — Retorna um simulado do pool Redis

Simulados são gerados em lote pelo GPT-5.6 Luna e cacheados no Redis por 7 dias.
Cada requisição consome um item do pool; o pool é reabastecido em background
quando cai abaixo do mínimo configurado.
"""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl

from app.core.dependencies import get_current_user, get_redis
from app.core.logging import get_logger
from app.core.rate_limiter import RateLimiter, release_monthly_credit, reserve_monthly_credit
from app.db.models.user import User
from app.services.ai.simulado_service import SimuladoService

router = APIRouter(tags=["Simulados"])
logger = get_logger(__name__)


class MotivatingTextResponse(BaseModel):
    title: str
    content: str
    source_name: str
    source_url: HttpUrl
    source_date: str | None
    material_type: Literal["article", "data", "legal", "research", "historical", "visual"]


class SimuladoResponse(BaseModel):
    id: str
    essay_type: str
    theme: str
    prompt: str
    motivating_texts: list[MotivatingTextResponse]
    time_suggested_minutes: int
    generated_at: str


@router.get("/simulados/new", response_model=SimuladoResponse)
async def get_new_simulado(
    type: Literal["enem", "vestibular"] = "enem",
    current_user: Annotated[User, Depends(get_current_user)] = None,
    redis_client=Depends(get_redis),
) -> SimuladoResponse:
    """
    Retorna um simulado de redação para praticar.

    Consome um crédito mensal de simulado conforme o plano.
    Servido de um pool Redis — geração com GPT-5.6 Luna em lote para reduzir custo.
    """
    limiter = RateLimiter(redis_client)
    if not await limiter.check("simulado_generation", str(current_user.id), 10, 600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitos simulados solicitados. Aguarde alguns minutos.",
        )

    allowed, _, limit, _ = await reserve_monthly_credit(
        str(current_user.id), current_user.plan.value, redis_client, resource="simulations"
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Você utilizou seus {limit} tema(s) ou simulado(s) deste mês.",
        )

    service = SimuladoService()
    try:
        simulado = await service.get_simulado(type, redis_client)
    except ValueError as e:
        await release_monthly_credit(str(current_user.id), redis_client, resource="simulations")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        await release_monthly_credit(str(current_user.id), redis_client, resource="simulations")
        logger.error("erro_get_simulado", error=str(e), user_id=str(current_user.id))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço temporariamente indisponível. Tente novamente.",
        )

    logger.info("simulado_servido", user_id=str(current_user.id), essay_type=type)
    return SimuladoResponse(**simulado)
