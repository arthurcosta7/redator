"""Contestacoes de correcoes com trilha de auditoria humana."""
import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.field_encryption import EncryptedJSON, EncryptedText
from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.db.models.correction import Correction
    from app.db.models.essay import Essay
    from app.db.models.user import User


class AppealStatus(str, enum.Enum):
    PENDING = "pending"
    IN_REVIEW = "in_review"
    UPHELD = "upheld"
    CORRECTED = "corrected"


class CorrectionAppeal(UUIDMixin, TimestampMixin, Base):
    """Uma unica contestacao por correcao, preservando o antes e o depois."""

    __tablename__ = "correction_appeals"

    correction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("corrections.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    essay_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("essays.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[AppealStatus] = mapped_column(
        Enum(AppealStatus, name="appeal_status_enum"),
        nullable=False,
        default=AppealStatus.PENDING,
        index=True,
    )
    student_reason: Mapped[str] = mapped_column(EncryptedText(), nullable=False)
    allow_anonymized_improvement: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Estes snapshots preservam exatamente o que a IA apresentou no momento
    # da contestação, mesmo que a Correction seja atualizada após a revisão.
    original_total_score: Mapped[float] = mapped_column(Float, nullable=False)
    original_competencies: Mapped[list] = mapped_column(EncryptedJSON(), nullable=False)
    original_highlights: Mapped[list] = mapped_column(EncryptedJSON(), nullable=False)
    original_insights: Mapped[dict] = mapped_column(EncryptedJSON(), nullable=False)
    original_ai_model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    corrected_total_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    corrected_competencies: Mapped[list | None] = mapped_column(EncryptedJSON(), nullable=True)
    reviewer_explanation: Mapped[str | None] = mapped_column(EncryptedText(), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    training_eligible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )

    correction: Mapped["Correction"] = relationship(  # type: ignore
        "Correction", back_populates="appeal"
    )
    essay: Mapped["Essay"] = relationship(  # type: ignore
        "Essay", back_populates="correction_appeal"
    )
    student: Mapped["User"] = relationship(  # type: ignore
        "User", foreign_keys=[student_id]
    )
    reviewer: Mapped["User | None"] = relationship(  # type: ignore
        "User", foreign_keys=[reviewer_id]
    )
