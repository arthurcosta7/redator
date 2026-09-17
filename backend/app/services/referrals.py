"""Atribuição privada de indicações e sinais antifraude de curta duração."""
import hashlib
import hmac
from datetime import UTC, datetime
from uuid import UUID

from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.db.models.referral import ReferralAttribution, ReferralLink
from app.db.models.user import User

logger = get_logger(__name__)
_SIGNAL_TTL = 90 * 24 * 60 * 60


def _signal_key(owner_id: UUID, kind: str, value: str) -> str:
    """Nunca coloca IP/identificador bruto em Redis ou logs."""
    digest = hmac.new(
        settings.SECRET_KEY.encode(),
        f"referral:{owner_id}:{kind}:{value}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"referral_signal:{digest}"


async def attribute_signup(
    db: AsyncSession,
    redis_client,
    user: User,
    code: str | None,
    ip: str,
    device_id: str | None,
) -> None:
    """Atribui uma única vez, apenas durante a criação da conta.

    Reuso de rede ou cookie marca revisão; não impede cadastro legítimo.
    O identificador local é manipulável e não é tratado como HWID.
    """
    if not code:
        return
    result = await db.execute(select(ReferralLink).join(
        User, User.id == ReferralLink.owner_id
    ).where(
        ReferralLink.code == code, ReferralLink.is_active.is_(True),
        User.is_active.is_(True), User.admin_role.is_(None),
    ))
    link = result.scalar_one_or_none()
    if link is None or link.owner_id == user.id:
        return

    reason = None
    try:
        if ip and ip != "unknown":
            fresh_ip = await redis_client.set(
                _signal_key(link.owner_id, "ip", ip), str(user.id), ex=_SIGNAL_TTL, nx=True
            )
            if not fresh_ip:
                reason = "shared_network"
        if device_id:
            fresh_device = await redis_client.set(
                _signal_key(link.owner_id, "device", device_id), str(user.id),
                ex=_SIGNAL_TTL, nx=True,
            )
            if not fresh_device:
                reason = "shared_device"
    except (RedisError, OSError, TimeoutError) as exc:
        # Indicação financeira falha fechada; cadastro normal continua disponível.
        logger.warning("referral_signal_unavailable", error_type=type(exc).__name__)
        reason = "signal_unavailable"

    db.add(ReferralAttribution(
        link_id=link.id,
        user_id=user.id,
        status="review" if reason else "valid",
        risk_reason=reason,
    ))
    logger.info("referral_signup_attributed", user_id=str(user.id), link_id=str(link.id), status="review" if reason else "valid")


async def mark_paid_conversion(db: AsyncSession, user_id: UUID) -> None:
    """Idempotente: conta o primeiro pagamento real, não checkout iniciado."""
    result = await db.execute(select(ReferralAttribution).where(
        ReferralAttribution.user_id == user_id
    ))
    attribution = result.scalar_one_or_none()
    if attribution and attribution.converted_at is None:
        attribution.converted_at = datetime.now(UTC)
        logger.info("referral_paid_conversion", attribution_id=str(attribution.id))
