"""
base.py — Base para todos os modelos do banco de dados

Define a classe Base que todos os modelos herdam, com campos
comuns (id, created_at, updated_at) já configurados.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Classe base para todos os modelos SQLAlchemy."""
    pass


class TimestampMixin:
    """
    Mixin que adiciona campos de timestamp automáticos.

    Todos os modelos que herdam este mixin terão:
    - created_at: quando foi criado (preenchido automaticamente)
    - updated_at: quando foi atualizado pela última vez (atualizado automaticamente)
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),      # Banco define automaticamente
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),            # Atualiza automaticamente
        nullable=False,
    )


class UUIDMixin:
    """
    Mixin que usa UUID como chave primária.

    Por que UUID em vez de integer sequencial?
    SEGURANÇA: IDs inteiros sequenciais permitem que um atacante
    adivinhe IDs de outros usuários (IDOR attack).
    Com UUIDs, é impossível adivinhar o ID de outro registro.

    Exemplo de IDOR:
    - Ruim:  GET /api/essays/1, /essays/2, /essays/3... (previsível!)
    - Bom:   GET /api/essays/f47ac10b-58cc-4372-a567-0e02b2c3d479 (impossível adivinhar)
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,             # Gera UUID automaticamente
        nullable=False,
    )
