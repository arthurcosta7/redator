"""Links privados e atribuições de cadastro por indicação."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class ReferralLink(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "referral_links"

    code: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ReferralAttribution(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "referral_attributions"

    link_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("referral_links.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    # Review não é rejeição: redes de escolas e famílias podem ser compartilhadas.
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="valid")
    risk_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_payment_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)


class ReferralClick(UUIDMixin, TimestampMixin, Base):
    """Clique agregado; nenhum IP ou user-agent é persistido."""
    __tablename__ = "referral_clicks"

    link_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("referral_links.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
