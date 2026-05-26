"""
refresh_token.py — Modelo de Refresh Token

Por que armazenar refresh tokens no banco?
- Permite revogar tokens (logout, troca de senha, conta comprometida)
- Detecta uso de tokens roubados (um token usado duas vezes = alerta!)
- Permite "logout de todos os dispositivos"

SEGURANÇA: O token real não é armazenado — apenas seu hash SHA-256.
Se o banco for comprometido, os hashes não servem para autenticar.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class RefreshToken(UUIDMixin, TimestampMixin, Base):
    """
    Refresh token de um usuário.

    Rotação de tokens:
    - Cada vez que o access token é renovado, um NOVO refresh token é emitido
    - O token antigo é imediatamente revogado
    - Se um token já revogado for usado, é um sinal de comprometimento!
    """
    __tablename__ = "refresh_tokens"

    # ─── Relacionamento ───────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ─── Token (apenas o hash) ────────────────────────────────────
    # Hash SHA-256 do token real
    token_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )

    # ─── Metadados ────────────────────────────────────────────────
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Quando foi revogado (None = ainda válido)
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # IP que criou o token (para auditoria de segurança)
    created_from_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    # User-Agent do dispositivo (para mostrar na lista de sessões)
    user_agent: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # ─── Relacionamentos ──────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")  # type: ignore

    @property
    def is_valid(self) -> bool:
        """Token é válido se não foi revogado e não expirou."""
        from datetime import timezone
        from datetime import datetime as dt
        return (
            self.revoked_at is None
            and dt.now(timezone.utc) < self.expires_at
        )

    def __repr__(self) -> str:
        return f"<RefreshToken user={self.user_id} valid={self.is_valid}>"
