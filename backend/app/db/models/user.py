"""
user.py — Modelo de Usuário

Representa tanto alunos quanto professores.
user_type diferencia os dois tipos de conta.
"""
import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.field_encryption import EncryptedText
from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.db.models.essay import Essay
    from app.db.models.refresh_token import RefreshToken
    from app.db.models.subscription import Subscription


class UserType(str, enum.Enum):
    """Tipo de conta no sistema."""
    STUDENT = "student"
    TEACHER = "teacher"


class UserPlan(str, enum.Enum):
    """
    Plano de assinatura do usuário.
    O plano determina os créditos mensais de correção e as funcionalidades.
    """
    FREE = "free"
    STANDARD = "standard"
    PRO = "pro"


class AdminRole(str, enum.Enum):
    """
    Nível de acesso administrativo.

    Hierarquia (do mais ao menos privilegiado):
    - SUPERADMIN: Acesso total. Pode gerenciar outros admins.
    - ADMIN: Gerenciamento de usuários e redações. Não pode gerenciar admins.
    - ANALYST: Somente leitura — analytics, relatórios, dados agregados.
    - SUPPORT: Pode ver usuários/redações e agir em suporte (ban, verificar email).
    - LICENSED_TEACHER: Analisa contestações de correção, sem acesso administrativo geral.

    Usuários sem admin_role (None) são usuários comuns — sem acesso ao painel.
    SEGURANÇA: Este campo é verificado no servidor a cada requisição admin,
    NUNCA confiamos no token JWT para determinar acesso administrativo.
    """
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    ANALYST = "analyst"
    SUPPORT = "support"
    LICENSED_TEACHER = "licensed_teacher"
    SALES = "sales"
    MARKETING_MANAGER = "marketing_manager"


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
    # Perfil acadêmico não participa de buscas e fica cifrado em repouso.
    school_name: Mapped[str | None] = mapped_column(EncryptedText(), nullable=True)
    discipline: Mapped[str | None] = mapped_column(EncryptedText(), nullable=True)

    # ─── Dados para alunos ────────────────────────────────────────
    grade: Mapped[str | None] = mapped_column(EncryptedText(), nullable=True)  # "3º ano EM"

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

    # ─── Acesso administrativo ────────────────────────────────────
    # SEGURANÇA: Null = usuário comum, sem acesso ao painel admin.
    # O nível de acesso é sempre verificado no banco — nunca no token.
    admin_role: Mapped[AdminRole | None] = mapped_column(
        Enum(AdminRole, name="admin_role_enum"),
        nullable=True,
        default=None,
        index=True,
    )

    # ─── Stripe ───────────────────────────────────────────────────
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )

    # ─── Plano de professor ───────────────────────────────────────
    # 0 = Professor Free (3 vagas); 30/60/100 = capacidade comercial total.
    teacher_student_slots: Mapped[int] = mapped_column(
        default=0, nullable=False
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
        return datetime.now(timezone.utc) < self.locked_until
