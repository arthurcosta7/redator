"""
admin.py — Schemas Pydantic para o painel administrativo

SEGURANÇA:
- Todos os schemas omitem dados sensíveis (hashed_password, tokens de reset).
- Campos como email só são expostos a admins autenticados via endpoints protegidos.
- AdminTeamInvite valida email antes de qualquer persistência.
"""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

from app.db.models.user import AdminRole, UserPlan, UserType


# ─────────────────────────────────────────────────────────────────────────────
# Usuários
# ─────────────────────────────────────────────────────────────────────────────

class AdminUserItem(BaseModel):
    """Usuário na listagem do painel admin — sem dados hipersensíveis."""
    id: str
    full_name: str
    email: str
    user_type: str
    plan: str
    is_active: bool
    is_email_verified: bool
    admin_role: Optional[str]
    created_at: str
    essay_count: int = 0

    model_config = {"from_attributes": True}


class AdminUserDetail(BaseModel):
    """Detalhe completo de um usuário — inclui campos de segurança (somente leitura)."""
    id: str
    full_name: str
    email: str
    user_type: str
    plan: str
    is_active: bool
    is_email_verified: bool
    admin_role: Optional[str]
    school_name: Optional[str]
    discipline: Optional[str]
    grade: Optional[str]
    failed_login_attempts: int
    locked_until: Optional[str]
    created_at: str
    essay_count: int = 0
    last_essay_at: Optional[str] = None

    model_config = {"from_attributes": True}


class AdminUserUpdate(BaseModel):
    """
    Campos que um admin pode alterar em um usuário.

    SEGURANÇA: Não permite alterar email, senha ou role admin por aqui —
    cada ação sensível tem seu próprio endpoint auditado.
    """
    plan: Optional[UserPlan] = None
    is_active: Optional[bool] = None
    is_email_verified: Optional[bool] = None
    user_type: Optional[UserType] = None


class AdminUsersResponse(BaseModel):
    """Resposta paginada da listagem de usuários."""
    items: list[AdminUserItem]
    total: int
    page: int
    per_page: int
    has_more: bool


# ─────────────────────────────────────────────────────────────────────────────
# Redações
# ─────────────────────────────────────────────────────────────────────────────

class AdminEssayItem(BaseModel):
    """Redação na listagem do painel admin."""
    id: str
    title: Optional[str]
    essay_type: str
    input_type: str
    status: str
    word_count: Optional[int]
    created_at: str
    user_id: str
    user_name: str
    user_email: str
    total_score: Optional[int] = None
    max_score: Optional[int] = None

    model_config = {"from_attributes": True}


class AdminEssaysResponse(BaseModel):
    """Resposta paginada da listagem de redações."""
    items: list[AdminEssayItem]
    total: int
    page: int
    per_page: int
    has_more: bool


# ─────────────────────────────────────────────────────────────────────────────
# Estatísticas e Analytics
# ─────────────────────────────────────────────────────────────────────────────

class AdminStats(BaseModel):
    """Estatísticas gerais do painel admin."""
    total_users: int
    active_users: int
    new_users_today: int
    new_users_week: int
    total_essays: int
    essays_today: int
    essays_week: int
    corrections_completed: int
    corrections_today: int
    plan_distribution: dict[str, int]      # {"free": N, "standard": N, "pro": N}
    user_type_distribution: dict[str, int] # {"student": N, "teacher": N}
    essay_type_distribution: dict[str, int]# {"enem": N, "vestibular": N}
    status_distribution: dict[str, int]    # {"completed": N, "pending": N, ...}


class AdminAnalyticsDay(BaseModel):
    """Dados de analytics por dia (últimos 30 dias)."""
    date: str           # "2024-01-15"
    essays_submitted: int
    corrections_completed: int
    new_users: int


class AdminAnalytics(BaseModel):
    """Analytics dos últimos 30 dias."""
    daily: list[AdminAnalyticsDay]


# ─────────────────────────────────────────────────────────────────────────────
# Equipe administrativa
# ─────────────────────────────────────────────────────────────────────────────

class AdminTeamMember(BaseModel):
    """Membro da equipe admin."""
    id: str
    full_name: str
    email: str
    admin_role: str
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}


class AdminTeamInvite(BaseModel):
    """
    Convite para novo membro admin.

    SEGURANÇA: O usuário com este email JÁ deve existir no sistema.
    Não criamos contas novas por aqui — apenas concedemos acesso admin
    a uma conta existente.
    """
    email: EmailStr
    admin_role: AdminRole

    @field_validator("admin_role")
    @classmethod
    def cannot_invite_superadmin(cls, v: AdminRole) -> AdminRole:
        """
        SEGURANÇA: Superadmin não pode ser criado via API.
        Deve ser configurado diretamente no banco de dados.
        Isso evita escalada de privilégios.
        """
        if v == AdminRole.SUPERADMIN:
            raise ValueError(
                "Superadmin não pode ser criado via painel. "
                "Configure diretamente no banco de dados."
            )
        return v


class AdminTeamRoleUpdate(BaseModel):
    """Atualização de role de um membro admin."""
    admin_role: AdminRole

    @field_validator("admin_role")
    @classmethod
    def cannot_promote_to_superadmin(cls, v: AdminRole) -> AdminRole:
        """SEGURANÇA: Promoção a superadmin via API é bloqueada."""
        if v == AdminRole.SUPERADMIN:
            raise ValueError(
                "Não é possível promover para superadmin via API. "
                "Use o banco de dados diretamente."
            )
        return v
