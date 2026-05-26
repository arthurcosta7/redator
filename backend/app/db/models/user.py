"""
user.py — Modelo de Usuário

Representa tanto alunos quanto professores.
user_type diferencia os dois tipos de conta.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class UserType(str, enum.Enum):
    """Tipo de conta no sistema."""
    STUDENT = "student"
    TEACHER = "teacher"


class UserPlan(str, enum.Enum):
    """
    Plano de assinatura do usuário.
    O plano determina quantas correções por dia e quais funcionalidades.
    """
    FREE = "free"
    STANDARD = "standard"
    PRO = "pro"


class User(UUIDMixin, TimestampMixin, Base):
    """
    Modelo de usuário do Redator.

    Campos de segurança:
    - hashed_password: NUNCA armazenamos a senha em texto puro
    - is_email_verified: Usuário não pode usar a conta sem verificar email
    - is_active: Permite suspender contas sem deletar dados
    - failed_login_attempts: Rastreia tentativas fracassadas de login
    - locked_until: Bloqueia conta após muitas tentativas (adicionalmente ao rate limiter)
    """
    __tablename__ = "users"

    # ─── Dados pessoais ───────────────────────────────────────────
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,     # Index para buscas rápidas por email
        nullable=False,
    )

    # SEGURANÇA: Senha sempre em hash, nunca texto puro
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # ─── Tipo de conta ────────────────────────────────────────────
    user_type: Mapped[UserType] = mapped_column(
        Enum(UserType, name="user_type_enum"),
        nullable=False,
        default=UserType.STUDENT,
    )

    # ─── Plano de assinatura ──────────────────────────────────────
    plan: Mapped[UserPlan] = mapped_column(
        Enum(UserPlan, name="user_plan_enum"),
        nullable=False,
        default=UserPlan.FREE,
    )

    # ─── Status da conta ──────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ─── Dados para professores ───────────────────────────────────
    school_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    discipline: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ─── Dados para alunos ────────────────────────────────────────
    grade: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "3º ano EM"

    # ─── Segurança de conta ───────────────────────────────────────
    failed_login_attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Token de verificação de email (armazenamos o HASH, não o token em si)
    email_verification_token_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Token de reset de senha (armazenamos o HASH)
    password_reset_token_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ─── Stripe ───────────────────────────────────────────────────
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )

    # ─── Relacionamentos ──────────────────────────────────────────
    essays: Mapped[list["Essay"]] = relationship(  # type: ignore
        "Essay", back_populates="user", lazy="dynamic"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(  # type: ignore
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    subscription: Mapped["Subscription | None"] = relationship(  # type: ignore
        "Subscription", back_populates="user", uselist=False
    )

    def __repr__(self) -> str:
        # SEGURANÇA: Não inclui email completo no repr
        return f"<User id={self.id} type={self.user_type} plan={self.plan}>"

    @property
    def is_locked(self) -> bool:
        """Verifica se a conta está bloqueada por tentativas de login."""
        if self.locked_until is None:
            return False
        from datetime import timezone
        from datetime import datetime as dt
        return dt.now(timezone.utc) < self.locked_until
