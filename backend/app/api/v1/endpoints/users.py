"""
users.py — Endpoints de perfil de usuário

GET /users/me       — Retorna o perfil do usuário autenticado
PATCH /users/me     — Atualiza nome, grade/escola/disciplina
DELETE /users/me    — Desativa a conta (soft delete)

SEGURANÇA:
- Todos os endpoints exigem autenticação via get_current_user
- Usuários só podem ver/editar o próprio perfil (IDOR impossível)
- Campos sensíveis (hashed_password, tokens de reset) nunca retornam na resposta
- Inputs validados por Pydantic v2
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.core.logging import get_logger
from app.core.security import hash_password, validate_bcrypt_password_size, verify_password
from app.db.models.user import User, UserType

logger = get_logger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


# ─── Schemas de resposta ───────────────────────────────────────────────────────

class UserMeResponse(BaseModel):
    """Dados do perfil retornados para o próprio usuário."""
    id: str
    full_name: str
    email: str
    user_type: str
    plan: str
    is_email_verified: bool
    grade: str | None
    school_name: str | None
    discipline: str | None
    created_at: str
    admin_role: str | None = None
    has_stripe_subscription: bool = False  # True = assinou pelo Stripe (pode usar portal)
    teacher_student_slots: int = 0  # 0 = free, >0 = pacote(s) pago(s)

    model_config = {"from_attributes": True}


# ─── Schemas de entrada ────────────────────────────────────────────────────────

class UpdateProfileRequest(BaseModel):
    """Campos que o usuário pode atualizar no próprio perfil."""
    full_name: str | None = Field(
        default=None,
        min_length=3,
        max_length=100,
        description="Nome completo (mínimo 2 palavras)",
    )
    grade: str | None = Field(
        default=None,
        max_length=50,
        description="Série/ano do aluno (opcional)",
    )
    school_name: str | None = Field(
        default=None,
        max_length=200,
        description="Nome da escola (professores)",
    )
    discipline: str | None = Field(
        default=None,
        max_length=100,
        description="Disciplina (professores)",
    )
    # Campos para alteração de senha (opcional — apenas se ambos presentes)
    current_password: str | None = Field(
        default=None,
        max_length=128,
        description="Senha atual (necessária para alterar a senha)",
    )
    new_password: str | None = Field(
        default=None,
        min_length=8,
        max_length=72,  # Limite do bcrypt
        description="Nova senha (mínimo 8 caracteres)",
    )

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if len(v.split()) < 2:
            raise ValueError("Digite nome e sobrenome")
        return v

    @field_validator("grade", "school_name", "discipline", mode="before")
    @classmethod
    def strip_optional_strings(cls, v):
        if v is None or v == "":
            return None
        return str(v).strip()

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str | None) -> str | None:
        if v is None:
            return v
        validate_bcrypt_password_size(v)
        if not any(c.isupper() for c in v):
            raise ValueError("A senha precisa de pelo menos uma letra maiúscula")
        if not any(c.islower() for c in v):
            raise ValueError("A senha precisa de pelo menos uma letra minúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("A senha precisa de pelo menos um número")
        return v


# ─── Helper ────────────────────────────────────────────────────────────────────

def _serialize_user(user: User) -> UserMeResponse:
    return UserMeResponse(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        user_type=user.user_type.value,
        plan=user.plan.value,
        is_email_verified=user.is_email_verified,
        grade=user.grade,
        school_name=user.school_name,
        discipline=user.discipline,
        created_at=user.created_at.isoformat(),
        admin_role=user.admin_role.value if user.admin_role else None,
        has_stripe_subscription=user.stripe_customer_id is not None,
        teacher_student_slots=user.teacher_student_slots,
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserMeResponse)
async def get_my_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserMeResponse:
    """
    Retorna o perfil completo do usuário autenticado.

    SEGURANÇA: O usuário só pode ver o próprio perfil — a dependência
    get_current_user já garante isso através do token JWT.
    Campos sensíveis (hashed_password, tokens) são excluídos do schema.
    """
    return _serialize_user(current_user)


@router.patch("/me", response_model=UserMeResponse)
async def update_my_profile(
    body: UpdateProfileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserMeResponse:
    """
    Atualiza os dados de perfil do usuário.

    Apenas campos não nulos no body são atualizados (PATCH semântico).
    Não permite alterar email, senha ou plano por este endpoint.
    """
    updated = False

    if body.full_name is not None:
        current_user.full_name = body.full_name
        updated = True

    # Campos específicos por tipo de usuário
    if current_user.user_type == UserType.STUDENT:
        if body.grade is not None:
            current_user.grade = body.grade
            updated = True
    else:
        # Teacher
        if body.school_name is not None:
            current_user.school_name = body.school_name
            updated = True
        if body.discipline is not None:
            current_user.discipline = body.discipline
            updated = True

    # ─── Alteração de senha ────────────────────────────────────────────────────
    if body.new_password is not None:
        if not body.current_password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Informe a senha atual para alterar a senha.",
            )
        # SEGURANÇA: Verifica a senha atual antes de qualquer alteração
        if not verify_password(body.current_password, current_user.hashed_password):
            # SEGURANÇA: Usa mensagem genérica; não revela se o usuário existe
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Senha atual incorreta.",
            )
        current_user.hashed_password = hash_password(body.new_password)
        updated = True
        logger.info("password_changed", user_id=str(current_user.id))

    if updated:
        await db.flush()
        logger.info("profile_updated", user_id=str(current_user.id))

    return _serialize_user(current_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Desativa a conta do usuário (soft delete).

    Não deleta os dados imediatamente — apenas marca is_active=False.
    A conta pode ser reativada por um administrador.
    Os dados de redações/correções são preservados.
    """
    current_user.is_active = False
    await db.flush()

    logger.info("account_deactivated", user_id=str(current_user.id))
