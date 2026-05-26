"""
auth.py — Schemas de autenticação

Pydantic valida AUTOMATICAMENTE todos os dados recebidos.
Se um campo não passar na validação, a API retorna 422 automaticamente.

SEGURANÇA: Nunca retornamos a senha (nem o hash) em nenhuma resposta.
"""
import re

from pydantic import BaseModel, EmailStr, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# Registro de usuário
# ─────────────────────────────────────────────────────────────────────────────

class RegisterStudentRequest(BaseModel):
    """Dados para criar uma conta de aluno."""

    full_name: str = Field(
        min_length=3,
        max_length=100,
        description="Nome completo do aluno",
    )
    email: EmailStr = Field(description="Email para login e comunicação")
    password: str = Field(
        min_length=8,
        max_length=72,  # Limite do bcrypt
        description="Senha da conta",
    )
    grade: str | None = Field(
        default=None,
        max_length=50,
        description="Série/ano (ex: 3º ano EM, 2º ano EF)",
    )

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Garante que a senha tem força mínima.

        Requisitos:
        - Mínimo 8 caracteres
        - Pelo menos uma letra maiúscula
        - Pelo menos uma letra minúscula
        - Pelo menos um número
        """
        if not re.search(r"[A-Z]", v):
            raise ValueError("A senha deve ter pelo menos uma letra maiúscula")
        if not re.search(r"[a-z]", v):
            raise ValueError("A senha deve ter pelo menos uma letra minúscula")
        if not re.search(r"\d", v):
            raise ValueError("A senha deve ter pelo menos um número")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        """Remove espaços extras e valida que tem pelo menos nome e sobrenome."""
        cleaned = " ".join(v.strip().split())
        if len(cleaned.split()) < 2:
            raise ValueError("Digite o nome completo (nome e sobrenome)")
        return cleaned


class RegisterTeacherRequest(RegisterStudentRequest):
    """Dados para criar uma conta de professor."""

    school_name: str | None = Field(
        default=None,
        max_length=200,
        description="Nome da escola/instituição",
    )
    discipline: str | None = Field(
        default=None,
        max_length=100,
        description="Disciplina que leciona",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Credenciais de login."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    # Indica se o usuário quer "lembrar de mim" (refresh token com vida mais longa)
    remember_me: bool = Field(default=False)


# ─────────────────────────────────────────────────────────────────────────────
# Reset de senha
# ─────────────────────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    """Solicita email de reset de senha."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Nova senha após reset."""

    token: str = Field(min_length=1, description="Token recebido no email")
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("A senha deve ter pelo menos uma letra maiúscula")
        if not re.search(r"[a-z]", v):
            raise ValueError("A senha deve ter pelo menos uma letra minúscula")
        if not re.search(r"\d", v):
            raise ValueError("A senha deve ter pelo menos um número")
        return v


# ─────────────────────────────────────────────────────────────────────────────
# Respostas da API (o que enviamos de volta ao cliente)
# ─────────────────────────────────────────────────────────────────────────────

class AuthResponse(BaseModel):
    """Resposta de login/registro bem-sucedido."""

    message: str
    user_type: str
    plan: str
    # NOTA: O access_token é enviado no COOKIE, não no body
    # Isso protege contra roubo via XSS


class MessageResponse(BaseModel):
    """Resposta genérica com mensagem."""
    message: str
