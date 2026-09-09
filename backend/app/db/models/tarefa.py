"""
tarefa.py — Modelos de Tarefa (Assignment)

Tarefas criadas por professores para alunos entregarem redações.
- Tarefa: a tarefa em si, ligada a uma turma
- TarefaSubmissao: a redação que um aluno enviou para uma tarefa específica

SEGURANÇA:
- Sempre verificar que tarefa.turma.teacher_id == current_user.id (IDOR)
- Aluno só pode ver/submeter tarefas de turmas das quais é ACTIVE member
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.field_encryption import EncryptedText
from app.db.base import Base, UUIDMixin


class Tarefa(UUIDMixin, Base):
    """
    Tarefa criada por um professor para uma turma.

    O professor pode:
    - Definir tema + textos motivadores manualmente
    - Pedir ao sistema para gerar via IA (is_ai_generated=True)
    - Definir prazo de entrega opcional

    A IA de correção SEMPRE usa o tema da tarefa ao corrigir,
    independente do que o aluno escrever no título.
    """
    __tablename__ = "tarefas"

    turma_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("turmas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Título da tarefa (ex: "Redação 1 — Semana 3")
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Instruções adicionais do professor (opcional)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Tipo do modelo: 'enem' ou 'vestibular'
    essay_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Tema obrigatório — a IA considera este tema na correção
    theme: Mapped[str] = mapped_column(String(500), nullable=False)

    # Textos motivadores (lista de {title: str, content: str})
    motivating_texts: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # Prazo de entrega (null = sem prazo)
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_ai_generated: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Fechamento manual pelo professor (independente do due_date)
    is_closed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

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

    submissoes: Mapped[list["TarefaSubmissao"]] = relationship(
        "TarefaSubmissao",
        back_populates="tarefa",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Tarefa id={self.id} title={self.title!r}>"


class TarefaSubmissao(UUIDMixin, Base):
    """
    Submissão de um aluno para uma tarefa.

    - Criada quando o aluno envia a redação.
    - essay_id aponta para a redação/correção normal do sistema.
    - Correções de tarefas NÃO descontam o limite diário do aluno.
    - O professor pode adicionar um comentário depois da correção automática.

    SEGURANÇA - IDOR:
    - Para professor: verificar tarefa.turma.teacher_id == current_user.id
    - Para aluno: verificar student_id == current_user.id
    """
    __tablename__ = "tarefa_submissoes"
    __table_args__ = (
        UniqueConstraint("tarefa_id", "student_id", name="uq_tarefa_submissao"),
    )

    tarefa_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tarefas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Null até o aluno submeter a redação
    essay_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("essays.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Comentário do professor após a correção automática (opcional)
    teacher_comment: Mapped[str | None] = mapped_column(EncryptedText(), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    tarefa: Mapped["Tarefa"] = relationship("Tarefa", back_populates="submissoes")
    student = relationship("User", foreign_keys=[student_id])
    essay = relationship("Essay", foreign_keys=[essay_id])

    def __repr__(self) -> str:
        return f"<TarefaSubmissao tarefa={self.tarefa_id} student={self.student_id}>"
