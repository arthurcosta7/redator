"""
essay.py — Modelo de Redação

Representa uma redação submetida para correção.
"""
import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.db.models.correction import Correction
    from app.db.models.correction_appeal import CorrectionAppeal
    from app.db.models.user import User


class EssayType(str, enum.Enum):
    """Modelo de redação suportado."""
    ENEM = "enem"
    VESTIBULAR = "vestibular"


class EssayStatus(str, enum.Enum):
    """Status de processamento da redação."""
    PENDING = "pending"         # Recebida, aguardando processamento
    PROCESSING = "processing"   # Sendo corrigida pela IA
    COMPLETED = "completed"     # Correção concluída
    ERROR = "error"             # Erro no processamento


class EssayInputType(str, enum.Enum):
    """Como a redação foi enviada."""
    TEXT = "text"       # Digitada pelo usuário
    PHOTO = "photo"     # Foto escaneada via OCR


class Essay(UUIDMixin, TimestampMixin, Base):
    """
    Modelo de redação submetida para correção.

    SEGURANÇA - IDOR prevention:
    Sempre verificar que essay.user_id == current_user.id
    antes de retornar ou modificar uma redação.
    Isso é feito nas queries (WHERE user_id = :user_id).
    """
    __tablename__ = "essays"

    # ─── Relacionamento com usuário ───────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ─── Dados da redação ─────────────────────────────────────────
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Tema proposto (ex: "Desafios da educação no Brasil")
    theme: Mapped[str | None] = mapped_column(String(500), nullable=True)

    essay_type: Mapped[EssayType] = mapped_column(
        Enum(EssayType, name="essay_type_enum"),
        nullable=False,
    )

    input_type: Mapped[EssayInputType] = mapped_column(
        Enum(EssayInputType, name="essay_input_type_enum"),
        nullable=False,
        default=EssayInputType.TEXT,
    )

    # ─── Status de processamento ──────────────────────────────────
    status: Mapped[EssayStatus] = mapped_column(
        Enum(EssayStatus, name="essay_status_enum"),
        nullable=False,
        default=EssayStatus.PENDING,
    )

    # Mensagem de erro (se houver), sem detalhes técnicos sensíveis
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Contagem de palavras (para validação de comprimento)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ─── Relacionamentos ──────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="essays")  # type: ignore
    correction: Mapped["Correction | None"] = relationship(  # type: ignore
        "Correction", back_populates="essay", uselist=False
    )
    correction_appeal: Mapped["CorrectionAppeal | None"] = relationship(  # type: ignore
        "CorrectionAppeal", back_populates="essay", uselist=False
    )

    def __repr__(self) -> str:
        return f"<Essay id={self.id} type={self.essay_type} status={self.status}>"
