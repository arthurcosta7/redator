"""
subscription.py — Modelo de Assinatura Stripe

Registra as assinaturas dos planos Standard e Pro.
Plano Free não gera registro aqui.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class SubscriptionStatus(str, enum.Enum):
    """Status da assinatura no Stripe."""
    ACTIVE = "active"
    CANCELLED = "cancelled"
    PAST_DUE = "past_due"       # Pagamento atrasado
    TRIALING = "trialing"
    INCOMPLETE = "incomplete"    # Pagamento inicial pendente


class Subscription(UUIDMixin, TimestampMixin, Base):
    """
    Assinatura de um usuário.

    Os IDs do Stripe são armazenados para sincronizar
    eventos de pagamento via webhooks.
    """
    __tablename__ = "subscriptions"

    # ─── Relacionamento ───────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,    # Um usuário tem no máximo uma assinatura ativa
        index=True,
    )

    # ─── Dados do Stripe ──────────────────────────────────────────
    stripe_subscription_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True
    )
    stripe_customer_id: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    stripe_price_id: Mapped[str] = mapped_column(String(100), nullable=False)

    # ─── Status e período ─────────────────────────────────────────
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscription_status_enum"),
        nullable=False,
    )

    current_period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    current_period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ─── Relacionamentos ──────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="subscription")  # type: ignore

    def __repr__(self) -> str:
        return f"<Subscription user={self.user_id} status={self.status}>"
