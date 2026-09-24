"""Leads internos do time comercial, separados das contas de alunos."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.field_encryption import EncryptedText
from app.db.base import Base, TimestampMixin, UUIDMixin


class MarketingLead(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "marketing_leads"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(EncryptedText(), nullable=False)
    email: Mapped[str | None] = mapped_column(EncryptedText())
    phone: Mapped[str | None] = mapped_column(EncryptedText())
    notes: Mapped[str | None] = mapped_column(EncryptedText())
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="new", index=True)
    consent_recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
