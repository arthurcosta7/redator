"""
insights.py — Insights agregados dos últimos 30 dias

GET /insights/summary — Estatísticas das correções recentes

Agrega dados já existentes no banco (sem chamada de IA).
Cache Redis por 1 hora por usuário — invalidado na próxima correção.
"""
import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, get_redis
from app.core.logging import get_logger
from app.db.models.correction import Correction
from app.db.models.essay import Essay
from app.db.models.user import User, UserPlan

router = APIRouter(tags=["Insights"])
logger = get_logger(__name__)

_CACHE_TTL = 3600  # 1 hora


class CompetencyAvg(BaseModel):
    number: int
    name: str
    avg_score: float
    max_score: float
    avg_percentage: float


class InsightsSummaryResponse(BaseModel):
    period_days: int = 30
    total_corrections: int
    avg_score: float
    avg_score_percentage: float
    score_trend: str              # improving | stable | declining | insufficient_data
    competency_averages: list[CompetencyAvg]
    weakest_competency: CompetencyAvg | None = None
    strongest_competency: CompetencyAvg | None = None
    most_common_improvements: list[str]
    writing_level: str            # iniciante | intermediário | avançado | sem dados
    corrections_by_type: dict[str, int]
    last_correction_at: str | None = None
    from_cache: bool = False


@router.get("/insights/summary", response_model=InsightsSummaryResponse)
async def get_insights_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client=Depends(get_redis),
) -> InsightsSummaryResponse:
    """
    Retorna insights agregados dos últimos 30 dias.
    Requer plano Standard ou Pro.
    """
    if current_user.plan == UserPlan.FREE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insights disponíveis nos planos Standard e Pro.",
        )

    # Tenta cache
    cache_key = f"insights_summary:{current_user.id}"
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            data = json.loads(cached)
            data["from_cache"] = True
            return InsightsSummaryResponse(**data)
    except Exception:
        pass  # Redis indisponível — continua sem cache

    # Busca correções dos últimos 30 dias
    since = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        select(Correction, Essay.essay_type)
        .join(Essay, Correction.essay_id == Essay.id)
        .where(
            Correction.user_id == current_user.id,
            Correction.created_at >= since,
        )
        .order_by(Correction.created_at.asc())
    )
    rows = result.all()

    if not rows:
        return InsightsSummaryResponse(
            total_corrections=0,
            avg_score=0.0,
            avg_score_percentage=0.0,
            score_trend="insufficient_data",
            competency_averages=[],
            most_common_improvements=[],
            writing_level="sem dados",
            corrections_by_type={},
            from_cache=False,
        )

    corrections = [row[0] for row in rows]
    essay_types = [row[1].value for row in rows]

    # Agrega dados
    comp_scores: dict[int, list[float]] = {}
    comp_meta: dict[int, tuple[str, float]] = {}  # number → (name, max_score)
    all_improvements: list[str] = []
    writing_levels: list[str] = []
    scores: list[float] = []

    for correction in corrections:
        scores.append(correction.total_score)

        for comp in (correction.competencies or []):
            n = comp["number"]
            comp_scores.setdefault(n, []).append(float(comp.get("score", 0)))
            comp_meta[n] = (comp.get("name", f"Competência {n}"), float(comp.get("max_score", 200)))
            all_improvements.extend(comp.get("improvements", []))

        insights = correction.insights or {}
        if wl := insights.get("writing_level"):
            writing_levels.append(wl)
        all_improvements.extend(insights.get("priority_improvements", []))

    # Médias por competência
    comp_avgs = []
    for n, score_list in sorted(comp_scores.items()):
        name, max_sc = comp_meta[n]
        avg = sum(score_list) / len(score_list)
        comp_avgs.append(CompetencyAvg(
            number=n,
            name=name,
            avg_score=round(avg, 1),
            max_score=max_sc,
            avg_percentage=round(avg / max_sc * 100, 1),
        ))

    weakest = min(comp_avgs, key=lambda c: c.avg_percentage) if comp_avgs else None
    strongest = max(comp_avgs, key=lambda c: c.avg_percentage) if comp_avgs else None

    # Tendência de evolução (compara primeira e segunda metade)
    trend = "insufficient_data"
    if len(scores) >= 4:
        mid = len(scores) // 2
        first_avg = sum(scores[:mid]) / mid
        second_avg = sum(scores[mid:]) / len(scores[mid:])
        max_possible = corrections[0].max_score or 1000.0
        threshold = max_possible * 0.03  # variação de 3% considera estável
        diff = second_avg - first_avg
        if diff > threshold:
            trend = "improving"
        elif diff < -threshold:
            trend = "declining"
        else:
            trend = "stable"
    elif len(scores) >= 2:
        trend = "stable"

    # Top 5 melhorias mais citadas
    top_improvements = [imp for imp, _ in Counter(all_improvements).most_common(5)]

    # Nível de escrita predominante
    writing_level = Counter(writing_levels).most_common(1)[0][0] if writing_levels else "sem dados"

    avg_score = sum(scores) / len(scores)
    max_score = corrections[0].max_score or 1000.0

    response = InsightsSummaryResponse(
        total_corrections=len(corrections),
        avg_score=round(avg_score, 1),
        avg_score_percentage=round(avg_score / max_score * 100, 1),
        score_trend=trend,
        competency_averages=comp_avgs,
        weakest_competency=weakest,
        strongest_competency=strongest,
        most_common_improvements=top_improvements,
        writing_level=writing_level,
        corrections_by_type=dict(Counter(essay_types)),
        last_correction_at=corrections[-1].created_at.isoformat(),
        from_cache=False,
    )

    # Salva no cache (sem o campo from_cache)
    try:
        cache_data = response.model_dump()
        cache_data.pop("from_cache", None)
        await redis_client.setex(cache_key, _CACHE_TTL, json.dumps(cache_data, default=str))
    except Exception:
        pass

    logger.info("insights_gerados", user_id=str(current_user.id), total=len(corrections))
    return response
