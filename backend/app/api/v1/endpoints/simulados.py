"""
simulados.py — Endpoints de simulados de redação

GET /simulados/new?type=enem|vestibular — Retorna um simulado do pool Redis

Simulados são gerados em lote pelo GPT-5.6 Luna e cacheados no Redis por 7 dias.
Cada requisição consome um item do pool; o pool é reabastecido em background
quando cai abaixo do mínimo configurado.
"""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_user, get_redis
from app.core.logging import get_logger
from app.db.models.user import User, UserPlan
from app.services.ai.simulado_service import SimuladoService

router = APIRouter(tags=["Simulados"])
logger = get_logger(__name__)


class SimuladoResponse(BaseModel):
    id: str
    essay_type: str
    theme: str
    prompt: str
    motivating_texts: list[str]
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

    Requer plano Standard ou Pro.
    Servido de um pool Redis — geração com GPT-5.6 Luna em lote para reduzir custo.
    """
    if current_user.plan == UserPlan.FREE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Simulados disponíveis nos planos Standard e Pro.",
        )

    service = SimuladoService()
    try:
        simulado = await service.get_simulado(type, redis_client)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        logger.error("erro_get_simulado", error=str(e), user_id=str(current_user.id))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço temporariamente indisponível. Tente novamente.",
        )

    logger.info("simulado_servido", user_id=str(current_user.id), essay_type=type)
    return SimuladoResponse(**simulado)
