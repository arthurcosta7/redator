"""Administração privada de links e revisão de indicações."""
import secrets
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db, require_admin_role
from app.core.logging import get_logger
from app.db.models.referral import ReferralAttribution, ReferralLink
from app.db.models.user import User

router = APIRouter(prefix="/admin/referrals", tags=["Admin - Indicações"])
logger = get_logger(__name__)


class CreateLinkRequest(BaseModel):
    owner_id: UUID


class ReviewRequest(BaseModel):
    status: Literal["valid", "rejected"]


class LinkResponse(BaseModel):
    id: UUID
    owner_id: UUID
    owner_name: str
    url: str
    is_active: bool
    signups: int
    valid_signups: int
    pending_review: int
    paid_conversions: int


class AttributionResponse(BaseModel):
    id: UUID
    link_id: UUID
    user_id: UUID
    user_name: str
    status: str
    risk_reason: str | None
    converted_at: datetime | None
    created_at: datetime


@router.get("", response_model=list[LinkResponse])
async def list_links(
    _admin: Annotated[User, Depends(require_admin_role("superadmin", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[LinkResponse]:
    counts = select(
        ReferralAttribution.link_id.label("link_id"),
        func.count(ReferralAttribution.id).label("signups"),
        func.sum(case((ReferralAttribution.status == "valid", 1), else_=0)).label("valid_signups"),
        func.sum(case((ReferralAttribution.status == "review", 1), else_=0)).label("pending_review"),
        func.sum(case((
            (ReferralAttribution.status == "valid") &
            ReferralAttribution.converted_at.is_not(None), 1
        ), else_=0)).label("paid_conversions"),
    ).group_by(ReferralAttribution.link_id).subquery()
    result = await db.execute(
        select(ReferralLink, User.full_name, counts.c.signups, counts.c.valid_signups,
               counts.c.pending_review, counts.c.paid_conversions)
        .join(User, User.id == ReferralLink.owner_id)
        .outerjoin(counts, counts.c.link_id == ReferralLink.id)
        .order_by(ReferralLink.created_at.desc())
    )
    return [LinkResponse(
        id=link.id, owner_id=link.owner_id, owner_name=name,
        url=f"{settings.FRONTEND_URL}/r/{link.code}", is_active=link.is_active,
        signups=signups or 0, valid_signups=valid or 0,
        pending_review=review or 0, paid_conversions=paid or 0,
    ) for link, name, signups, valid, review, paid in result.all()]


@router.post("", response_model=LinkResponse, status_code=201)
async def create_link(
    body: CreateLinkRequest,
    admin: Annotated[User, Depends(require_admin_role("superadmin", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LinkResponse:
    owner = await db.get(User, body.owner_id)
    if owner is None or not owner.is_active or owner.admin_role is not None:
        raise HTTPException(404, "Usuário elegível não encontrado.")
    link = ReferralLink(
        code=secrets.token_hex(24), owner_id=owner.id, created_by_id=admin.id,
        is_active=True,
    )
    db.add(link)
    await db.flush()
    logger.info("referral_link_created", link_id=str(link.id), admin_id=str(admin.id), owner_id=str(owner.id))
    return LinkResponse(
        id=link.id, owner_id=owner.id, owner_name=owner.full_name,
        url=f"{settings.FRONTEND_URL}/r/{link.code}", is_active=True,
        signups=0, valid_signups=0, pending_review=0, paid_conversions=0,
    )


@router.patch("/{link_id}/active", response_model=LinkResponse)
async def set_link_active(
    link_id: UUID,
    active: bool,
    admin: Annotated[User, Depends(require_admin_role("superadmin", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LinkResponse:
    link = await db.get(ReferralLink, link_id)
    if link is None:
        raise HTTPException(404, "Link não encontrado.")
    link.is_active = active
    logger.info("referral_link_status_changed", link_id=str(link.id), admin_id=str(admin.id), active=active)
    owner = await db.get(User, link.owner_id)
    result = await db.execute(select(
        func.count(ReferralAttribution.id),
        func.sum(case((ReferralAttribution.status == "valid", 1), else_=0)),
        func.sum(case((ReferralAttribution.status == "review", 1), else_=0)),
        func.sum(case((
            (ReferralAttribution.status == "valid") &
            ReferralAttribution.converted_at.is_not(None), 1
        ), else_=0)),
    ).where(ReferralAttribution.link_id == link_id))
    signups, valid, review, paid = result.one()
    return LinkResponse(
        id=link.id, owner_id=link.owner_id, owner_name=owner.full_name,
        url=f"{settings.FRONTEND_URL}/r/{link.code}", is_active=active,
        signups=signups or 0, valid_signups=valid or 0,
        pending_review=review or 0, paid_conversions=paid or 0,
    )


@router.get("/reviews", response_model=list[AttributionResponse])
async def list_reviews(
    _admin: Annotated[User, Depends(require_admin_role("superadmin", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AttributionResponse]:
    result = await db.execute(
        select(ReferralAttribution, User.full_name)
        .join(User, User.id == ReferralAttribution.user_id)
        .where(ReferralAttribution.status == "review")
        .order_by(ReferralAttribution.created_at.desc())
    )
    return [AttributionResponse(
        id=item.id, link_id=item.link_id, user_id=item.user_id,
        user_name=name, status=item.status, risk_reason=item.risk_reason,
        converted_at=item.converted_at, created_at=item.created_at,
    ) for item, name in result.all()]


@router.patch("/reviews/{attribution_id}", response_model=AttributionResponse)
async def review_attribution(
    attribution_id: UUID,
    body: ReviewRequest,
    admin: Annotated[User, Depends(require_admin_role("superadmin", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AttributionResponse:
    item = await db.get(ReferralAttribution, attribution_id)
    if item is None or item.status != "review":
        raise HTTPException(404, "Indicação pendente não encontrada.")
    item.status = body.status
    item.reviewed_by_id = admin.id
    item.reviewed_at = datetime.now(UTC)
    user = await db.get(User, item.user_id)
    logger.info("referral_reviewed", attribution_id=str(item.id), admin_id=str(admin.id), status=item.status)
    return AttributionResponse(
        id=item.id, link_id=item.link_id, user_id=item.user_id,
        user_name=user.full_name if user else "Conta removida", status=item.status,
        risk_reason=item.risk_reason, converted_at=item.converted_at,
        created_at=item.created_at,
    )
