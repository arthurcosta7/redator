"""
turma.py — Modelos de Turma

Representa turmas criadas por professores e seus membros.

SEGURANÇA:
- teacher_id DEVE ser verificado em todas as queries (IDOR prevention)
- user_id pode ser NULL para alunos sem conta cadastrada
- status=PENDING para convites aguardando aceite do aluno
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.field_encryption import EncryptedText
from app.db.base import Base, UUIDMixin


class TurmaMembroStatus(str, enum.Enum):
    """
    Status de um membro na turma.

    PENDING  → convidado pelo professor, aguardando aceite do aluno
    ACTIVE   → membro ativo (aceitou o convite ou foi adicionado offline)
    REMOVED  → removido pelo professor (soft delete)
    """
    PENDING = "pending"
    ACTIVE = "active"
    REMOVED = "removed"


class Turma(UUIDMixin, Base):
    """
    Turma criada por um professor.

    SEGURANÇA - IDOR prevention:
    Sempre verificar que turma.teacher_id == current_user.id antes
    de retornar, modificar ou deletar qualquer dado da turma.
    """
    __tablename__ = "turmas"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relacionamentos
    members: Mapped[list["TurmaMembro"]] = relationship(
        "TurmaMembro",
        back_populates="turma",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Turma id={self.id} name={self.name!r}>"


class TurmaMembro(UUIDMixin, Base):
    """
    Membro de uma turma.

    Dois tipos de membros:
    1. Com conta (user_id preenchido): aluno cadastrado no sistema.
       - Pode ser PENDING (aguardando aceite) ou ACTIVE (aceitou).
    2. Sem conta (user_id=NULL): aluno adicionado pelo nome pelo professor.
       - Sempre ACTIVE. Não tem acesso ao sistema.
       - Professor pode acompanhar pelo nome, mas sem dados de redação.

    SEGURANÇA - IDOR prevention:
    - Para operações de professor: verificar turma.teacher_id.
    - Para operações de aluno (aceitar/recusar): verificar membro.user_id == current_user.id.
    """
    __tablename__ = "turma_membros"

    turma_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("turmas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # NULL = aluno sem conta cadastrada no sistema
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Nome de exibição — obrigatório para alunos sem conta e cifrado em repouso.
    display_name: Mapped[str | None] = mapped_column(EncryptedText(), nullable=True)

    status: Mapped[TurmaMembroStatus] = mapped_column(
        Enum(
            TurmaMembroStatus,
            name="turma_membro_status_enum",
            # Usa os VALUES do enum Python (ex: "pending") em vez dos NAMES (ex: "PENDING")
            # sem isso, o asyncpg envia "REMOVED" mas o banco espera "removed"
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=TurmaMembroStatus.ACTIVE,
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relacionamentos
    turma: Mapped["Turma"] = relationship("Turma", back_populates="members")
    user: Mapped["User | None"] = relationship("User")  # type: ignore

    def __repr__(self) -> str:
        return f"<TurmaMembro id={self.id} turma={self.turma_id} user={self.user_id}>"
