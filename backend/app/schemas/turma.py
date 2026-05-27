"""
turma.py — Schemas Pydantic para turmas de professores

SEGURANÇA:
- Inputs são validados e sanitizados (bleach remove HTML)
- Emails validados com EmailStr
- Nenhum schema expõe hashed_password ou tokens
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

import bleach


# ─────────────────────────────────────────────────────────────────────────────
# Turma
# ─────────────────────────────────────────────────────────────────────────────

class TurmaCreate(BaseModel):
    """Dados para criar uma nova turma."""
    name: str = Field(min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return bleach.clean(v.strip(), tags=[], strip=True)

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = bleach.clean(v.strip(), tags=[], strip=True)
        return cleaned if cleaned else None


class TurmaUpdate(BaseModel):
    """Campos atualizáveis de uma turma."""
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return bleach.clean(v.strip(), tags=[], strip=True)

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = bleach.clean(v.strip(), tags=[], strip=True)
        return cleaned if cleaned else None


class TurmaListItem(BaseModel):
    """Turma na listagem do professor."""
    id: str
    name: str
    description: Optional[str]
    member_count: int = 0
    active_member_count: int = 0
    essay_count: int = 0
    created_at: str

    model_config = {"from_attributes": True}


class TurmaMembroItem(BaseModel):
    """Membro de uma turma."""
    id: str
    turma_id: str
    user_id: Optional[str]
    display_name: Optional[str]
    email: Optional[str]          # Apenas para membros com conta
    status: str
    joined_at: str
    essay_count: int = 0
    completed_count: int = 0
    avg_score_pct: Optional[float] = None
    last_essay_at: Optional[str] = None

    model_config = {"from_attributes": True}


class TurmaDetail(TurmaListItem):
    """Detalhe completo de uma turma com lista de membros."""
    members: list[TurmaMembroItem] = []


# ─────────────────────────────────────────────────────────────────────────────
# Operações de membros
# ─────────────────────────────────────────────────────────────────────────────

class AddOfflineStudentRequest(BaseModel):
    """Adiciona aluno por nome (sem conta no sistema)."""
    display_name: str = Field(min_length=2, max_length=100)

    @field_validator("display_name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return bleach.clean(v.strip(), tags=[], strip=True)


class InviteStudentRequest(BaseModel):
    """Convida aluno por email (deve ter conta cadastrada)."""
    email: EmailStr


# ─────────────────────────────────────────────────────────────────────────────
# Redações da turma
# ─────────────────────────────────────────────────────────────────────────────

class TurmaEssayItem(BaseModel):
    """Redação de um aluno de uma turma."""
    id: str
    title: Optional[str]
    essay_type: str
    status: str
    word_count: Optional[int]
    total_score: Optional[float]
    max_score: Optional[float]
    created_at: str
    # Dados do aluno
    student_id: Optional[str]
    student_name: str

    model_config = {"from_attributes": True}


class TurmaEssaysResponse(BaseModel):
    """Resposta paginada de redações da turma."""
    items: list[TurmaEssayItem]
    total: int
    page: int
    per_page: int
    has_more: bool


# ─────────────────────────────────────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────────────────────────────────────

class StudentAnalyticsItem(BaseModel):
    """Estatísticas de um aluno."""
    member_id: str
    user_id: Optional[str]
    display_name: str
    email: Optional[str]
    status: str
    essay_count: int = 0
    completed_count: int = 0
    avg_score_pct: Optional[float] = None
    last_essay_at: Optional[str] = None


class TurmaAnalyticsItem(BaseModel):
    """Estatísticas de uma turma (para overview)."""
    id: str
    name: str
    active_members: int
    essay_count: int
    completed_count: int
    avg_score_pct: Optional[float] = None


class ProfessorOverviewAnalytics(BaseModel):
    """Analytics gerais do professor."""
    turma_count: int
    active_member_count: int
    total_essay_count: int
    essays_this_week: int
    avg_score_pct: Optional[float]
    turmas: list[TurmaAnalyticsItem]


class TurmaFullAnalytics(BaseModel):
    """Analytics completo de uma turma."""
    turma_id: str
    turma_name: str
    active_members: int
    total_essays: int
    completed_essays: int
    avg_score_pct: Optional[float]
    students: list[StudentAnalyticsItem]


class StudentFullAnalytics(BaseModel):
    """Analytics completo de um aluno."""
    member_id: str
    user_id: Optional[str]
    display_name: str
    email: Optional[str]
    turma_id: str
    turma_name: str
    essay_count: int
    completed_count: int
    avg_score_pct: Optional[float]
    essays: list[TurmaEssayItem]


# ─────────────────────────────────────────────────────────────────────────────
# Convites (visão do aluno)
# ─────────────────────────────────────────────────────────────────────────────

class PendingInviteItem(BaseModel):
    """Convite pendente na visão do aluno."""
    member_id: str
    turma_id: str
    turma_name: str
    teacher_name: str
    created_at: str
