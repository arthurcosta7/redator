"""Operação comercial interna: métricas agregadas e leads manuais isolados."""
import hmac
import secrets
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from redis.exceptions import RedisError
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db, get_redis
from app.core.logging import get_logger
from app.core.marketing_session import require_marketing_actor
from app.core.rate_limiter import RateLimiter
from app.db.models.marketing import MarketingLead
from app.db.models.referral import ReferralAttribution, ReferralClick, ReferralLink
from app.db.models.user import AdminRole, User

router = APIRouter(prefix="/marketing", tags=["Marketing"])
logger = get_logger(__name__)
_MANAGERS = {AdminRole.MARKETING_MANAGER, AdminRole.ADMIN, AdminRole.SUPERADMIN}
_STATUS = Literal["new", "contacted", "negotiating", "converted", "lost"]


class LeadCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)
    status: _STATUS = "new"
    consent_confirmed: Literal[True]
    owner_id: UUID | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Informe um nome válido.")
        return cleaned


class LeadUpdate(BaseModel):
    status: _STATUS | None = None
    notes: str | None = Field(default=None, max_length=2000)


class ClickRequest(BaseModel):
    code: str = Field(pattern=r"^[a-f0-9]{48}$")


class LeadOut(BaseModel):
    id: UUID
    owner_id: UUID
    owner_name: str
    name: str
    email: str | None
    phone: str | None
    notes: str | None
    status: str
    created_at: datetime
    updated_at: datetime


def _visible_owner(actor: User, requested: UUID | None = None) -> UUID | None:
    if actor.admin_role not in _MANAGERS:
        if requested is not None and requested != actor.id:
            raise HTTPException(403, "Acesso não autorizado.")
        return actor.id
    return requested


@router.post("/referrals/click", status_code=204)
async def record_click(
    body: ClickRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Any, Depends(get_redis)],
    click_secret: str | None = Header(default=None, alias="X-Referral-Click-Secret"),
) -> None:
    # Só a rota /r do Next.js possui esse segredo de servidor. O IP nunca vai ao banco.
    if not settings.REFERRAL_CLICK_SECRET or not click_secret or not hmac.compare_digest(
        click_secret, settings.REFERRAL_CLICK_SECRET
    ):
        raise HTTPException(403, "Acesso não autorizado.")
    link = await db.scalar(select(ReferralLink).where(
        ReferralLink.code == body.code, ReferralLink.is_active.is_(True)
    ))
    if link is None:
        raise HTTPException(404, "Link não encontrado.")
    # Identificador limitado por link e por origem; não persiste IP ou user-agent.
    origin = request.headers.get("X-Referral-Visitor", "")
    if not origin or len(origin) > 64:
        raise HTTPException(400, "Origem inválida.")
    try:
        allowed = await RateLimiter(redis).check(
            "referral_click", f"{link.id}:{origin}", max_requests=100,
            window_seconds=3600,
        )
    except (RedisError, OSError, TimeoutError):
        # Tracking falha fechado; o redirecionamento público ainda funciona.
        raise HTTPException(503, "Métrica indisponível.")
    if not allowed:
        raise HTTPException(429, "Limite de cliques atingido.")
    db.add(ReferralClick(link_id=link.id))


@router.get("/referrals")
async def referral_links(
    actor: Annotated[User, Depends(require_marketing_actor)],
    db: Annotated[AsyncSession, Depends(get_db)],
    owner_id: UUID | None = None,
) -> list[dict]:
    scope = _visible_owner(actor, owner_id)
    clicks = select(ReferralClick.link_id, func.count(ReferralClick.id).label("count"))\
        .group_by(ReferralClick.link_id).subquery()
    attributions = select(
        ReferralAttribution.link_id,
        func.count(ReferralAttribution.id).label("signups"),
        func.sum(case((
            (ReferralAttribution.status == "valid") &
            ReferralAttribution.converted_at.is_not(None), 1
        ), else_=0)).label("paid"),
        func.sum(case((ReferralAttribution.status == "valid",
                       ReferralAttribution.first_payment_cents), else_=0)).label("revenue"),
    ).group_by(ReferralAttribution.link_id).subquery()
    query = (select(ReferralLink, User.full_name, clicks.c.count,
                    attributions.c.signups, attributions.c.paid, attributions.c.revenue)
             .join(User, User.id == ReferralLink.owner_id)
             .outerjoin(clicks, clicks.c.link_id == ReferralLink.id)
             .outerjoin(attributions, attributions.c.link_id == ReferralLink.id))
    if scope:
        query = query.where(ReferralLink.owner_id == scope)
    rows = (await db.execute(query.order_by(ReferralLink.created_at.desc()))).all()
    output = []
    for link, name, click_count, signups, paid, revenue in rows:
        output.append({"id": str(link.id), "owner_id": str(link.owner_id), "owner_name": name,
                       "url": f"{settings.FRONTEND_URL}/r/{link.code}", "is_active": link.is_active,
                       "clicks": click_count or 0, "signups": signups or 0,
                       "paid_conversions": paid or 0, "first_payment_cents": revenue or 0})
    return output


@router.get("/sellers")
async def list_sellers(
    actor: Annotated[User, Depends(require_marketing_actor)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    if actor.admin_role not in _MANAGERS:
        return [{"id": str(actor.id), "name": actor.full_name}]
    users = (await db.execute(select(User.id, User.full_name).where(
        User.is_active.is_(True),
        User.admin_role.in_((AdminRole.SALES, AdminRole.MARKETING_MANAGER)),
    ).order_by(User.full_name))).all()
    return [{"id": str(id), "name": name} for id, name in users]


@router.post("/referrals", status_code=201)
async def create_own_link(
    actor: Annotated[User, Depends(require_marketing_actor)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    # Vendedor mantém um único link pessoal; admin usa a rota legada para terceiros.
    # O bloqueio no usuário serializa duas requisições simultâneas do mesmo dono.
    await db.execute(select(User.id).where(User.id == actor.id).with_for_update())
    existing = await db.scalar(select(ReferralLink).where(ReferralLink.owner_id == actor.id)
                               .order_by(ReferralLink.created_at.asc()))
    if existing:
        return {"id": str(existing.id), "url": f"{settings.FRONTEND_URL}/r/{existing.code}"}
    link = ReferralLink(code=secrets.token_hex(24), owner_id=actor.id,
                        created_by_id=actor.id, is_active=True)
    db.add(link)
    await db.flush()
    logger.info("marketing_link_created", actor_id=str(actor.id), link_id=str(link.id))
    return {"id": str(link.id), "url": f"{settings.FRONTEND_URL}/r/{link.code}"}


@router.patch("/referrals/{link_id}/active", status_code=204)
async def set_link_active(
    link_id: UUID,
    active: bool,
    actor: Annotated[User, Depends(require_marketing_actor)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    link = await db.get(ReferralLink, link_id)
    if not link or (actor.admin_role not in _MANAGERS and link.owner_id != actor.id):
        raise HTTPException(404, "Link não encontrado.")
    link.is_active = active
    logger.info("marketing_link_status_changed", actor_id=str(actor.id), link_id=str(link.id), active=active)


@router.get("/dashboard")
async def dashboard(
    actor: Annotated[User, Depends(require_marketing_actor)],
    db: Annotated[AsyncSession, Depends(get_db)],
    owner_id: UUID | None = None,
) -> dict:
    scope = _visible_owner(actor, owner_id)
    since = datetime.now(UTC) - timedelta(days=29)
    link_ids = select(ReferralLink.id)
    if scope:
        link_ids = link_ids.where(ReferralLink.owner_id == scope)
    clicks = await db.scalar(select(func.count(ReferralClick.id)).where(ReferralClick.link_id.in_(link_ids))) or 0
    signups = await db.scalar(select(func.count(ReferralAttribution.id)).where(ReferralAttribution.link_id.in_(link_ids))) or 0
    paid = await db.scalar(select(func.count(ReferralAttribution.id)).where(
        ReferralAttribution.link_id.in_(link_ids), ReferralAttribution.status == "valid",
        ReferralAttribution.converted_at.is_not(None),
    )) or 0
    revenue = await db.scalar(select(func.coalesce(func.sum(ReferralAttribution.first_payment_cents), 0)).where(
        ReferralAttribution.link_id.in_(link_ids), ReferralAttribution.status == "valid",
    )) or 0
    lead_query = select(MarketingLead.status, func.count(MarketingLead.id)).group_by(MarketingLead.status)
    if scope:
        lead_query = lead_query.where(MarketingLead.owner_id == scope)
    lead_status = {status: count for status, count in (await db.execute(lead_query)).all()}

    async def daily(model, time_column, extra=None):
        query = select(func.date(time_column), func.count(model.id)).group_by(func.date(time_column))
        if model is MarketingLead:
            if scope:
                query = query.where(MarketingLead.owner_id == scope)
        else:
            query = query.where(model.link_id.in_(link_ids))
        query = query.where(time_column >= since)
        if extra is not None:
            query = query.where(extra)
        return {str(day): count for day, count in (await db.execute(query)).all()}

    click_days = await daily(ReferralClick, ReferralClick.created_at)
    signup_days = await daily(ReferralAttribution, ReferralAttribution.created_at)
    paid_days = await daily(ReferralAttribution, ReferralAttribution.converted_at,
                            ReferralAttribution.status == "valid")
    lead_days = await daily(MarketingLead, MarketingLead.created_at)
    today = datetime.now(UTC).date()
    days = []
    for index in range(30):
        day = (today - timedelta(days=29 - index)).isoformat()
        days.append({"date": day, "clicks": click_days.get(day, 0),
                     "signups": signup_days.get(day, 0), "paid": paid_days.get(day, 0),
                     "leads": lead_days.get(day, 0)})
    logger.info("marketing_dashboard_viewed", actor_id=str(actor.id), scope_id=str(scope) if scope else "all")
    return {"clicks": clicks, "signups": signups, "paid_conversions": paid,
            "first_payment_cents": revenue, "lead_status": lead_status, "daily": days}


@router.get("/leads")
async def list_leads(
    actor: Annotated[User, Depends(require_marketing_actor)],
    db: Annotated[AsyncSession, Depends(get_db)],
    owner_id: UUID | None = None,
    status: _STATUS | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
) -> dict:
    scope = _visible_owner(actor, owner_id)
    filters = []
    if scope:
        filters.append(MarketingLead.owner_id == scope)
    if status:
        filters.append(MarketingLead.status == status)
    if from_date:
        filters.append(MarketingLead.created_at >= datetime.combine(from_date, datetime.min.time(), UTC))
    if to_date:
        filters.append(MarketingLead.created_at < datetime.combine(to_date + timedelta(days=1), datetime.min.time(), UTC))
    total = await db.scalar(select(func.count(MarketingLead.id)).where(*filters)) or 0
    rows = (await db.execute(select(MarketingLead, User.full_name)
                             .join(User, User.id == MarketingLead.owner_id)
                             .where(*filters).order_by(MarketingLead.created_at.desc())
                             .limit(per_page).offset((page - 1) * per_page))).all()
    logger.info(
        "marketing_leads_viewed", actor_id=str(actor.id),
        scope_id=str(scope) if scope else "all",
        lead_ids=[str(lead.id) for lead, _ in rows],
    )
    return {"items": [LeadOut(id=lead.id, owner_id=lead.owner_id, owner_name=name,
                               name=lead.name, email=lead.email, phone=lead.phone,
                               notes=lead.notes, status=lead.status, created_at=lead.created_at,
                               updated_at=lead.updated_at) for lead, name in rows],
            "total": total, "page": page, "per_page": per_page}


@router.post("/leads", response_model=LeadOut, status_code=201)
async def create_lead(
    body: LeadCreate,
    actor: Annotated[User, Depends(require_marketing_actor)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LeadOut:
    owner_id = _visible_owner(actor, body.owner_id) or actor.id
    owner = await db.get(User, owner_id)
    if not owner or not owner.is_active or owner.admin_role not in (
        AdminRole.SALES, AdminRole.MARKETING_MANAGER, AdminRole.ADMIN, AdminRole.SUPERADMIN
    ):
        raise HTTPException(422, "Responsável comercial inválido.")
    lead = MarketingLead(owner_id=owner_id, name=body.name.strip(),
                         email=str(body.email) if body.email else None,
                         phone=body.phone, notes=body.notes, status=body.status,
                         consent_recorded_at=datetime.now(UTC))
    db.add(lead)
    await db.flush()
    logger.info("marketing_lead_created", actor_id=str(actor.id), lead_id=str(lead.id))
    return LeadOut(id=lead.id, owner_id=lead.owner_id, owner_name=owner.full_name,
                   name=lead.name, email=lead.email, phone=lead.phone, notes=lead.notes,
                   status=lead.status, created_at=lead.created_at, updated_at=lead.updated_at)


@router.patch("/leads/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: UUID,
    body: LeadUpdate,
    actor: Annotated[User, Depends(require_marketing_actor)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LeadOut:
    lead = await db.get(MarketingLead, lead_id)
    if not lead or (actor.admin_role not in _MANAGERS and lead.owner_id != actor.id):
        raise HTTPException(404, "Lead não encontrado.")
    if "status" in body.model_fields_set and body.status is not None:
        lead.status = body.status
    if "notes" in body.model_fields_set:
        lead.notes = body.notes
    await db.flush()
    await db.refresh(lead)
    owner = await db.get(User, lead.owner_id)
    logger.info("marketing_lead_updated", actor_id=str(actor.id), lead_id=str(lead.id))
    return LeadOut(id=lead.id, owner_id=lead.owner_id, owner_name=owner.full_name,
                   name=lead.name, email=lead.email, phone=lead.phone, notes=lead.notes,
                   status=lead.status, created_at=lead.created_at, updated_at=lead.updated_at)
