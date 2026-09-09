"""
tarefa.py — Schemas para tarefas (assignments) de professor

Validação de todos os inputs relacionados a tarefas.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.utils.text_sanitizer import sanitize_essay_text, sanitize_short_text


class MotivatingText(BaseModel):
    title: str = Field(max_length=200)
    content: str = Field(max_length=2000)

    @field_validator("title")
    @classmethod
    def sanitize_title(cls, v: str) -> str:
        return sanitize_short_text(v, 200)

    @field_validator("content")
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        return sanitize_essay_text(v)


class TarefaCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    instructions: Optional[str] = Field(default=None, max_length=2000)
    essay_type: str = Field(description="'enem' ou 'vestibular'")
    theme: str = Field(min_length=5, max_length=500)
    motivating_texts: Optional[list[MotivatingText]] = None
    due_date: Optional[datetime] = None

    @field_validator("essay_type")
    @classmethod
    def validate_essay_type(cls, v: str) -> str:
        if v not in ("enem", "vestibular"):
            raise ValueError("essay_type deve ser 'enem' ou 'vestibular'")
        return v

    @field_validator("title", "theme")
    @classmethod
    def sanitize_text(cls, v: str) -> str:
        return sanitize_short_text(v, 500)

    @field_validator("instructions")
    @classmethod
    def sanitize_instructions(cls, v: str | None) -> str | None:
        return sanitize_essay_text(v) if v else None


class TarefaUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    instructions: Optional[str] = Field(default=None, max_length=2000)
    theme: Optional[str] = Field(default=None, min_length=5, max_length=500)
    motivating_texts: Optional[list[MotivatingText]] = None
    due_date: Optional[datetime] = None

    @field_validator("title", "theme")
    @classmethod
    def sanitize_short_fields(cls, v: str | None) -> str | None:
        return sanitize_short_text(v, 500) if v else None

    @field_validator("instructions")
    @classmethod
    def sanitize_instructions(cls, v: str | None) -> str | None:
        return sanitize_essay_text(v) if v else None


class TarefaResponse(BaseModel):
    id: str
    turma_id: str
    title: str
    instructions: Optional[str]
    essay_type: str
    theme: str
    motivating_texts: Optional[list]
    due_date: Optional[str]
    is_ai_generated: bool
    is_closed: bool = False
    created_at: str
    submission_count: int = 0


class TarefaListItem(BaseModel):
    id: str
    title: str
    essay_type: str
    theme: str
    due_date: Optional[str]
    is_ai_generated: bool
    is_closed: bool = False
    created_at: str
    submission_count: int = 0


class SubmissaoItem(BaseModel):
    """Visão do professor de uma submissão de aluno."""
    id: str
    student_id: str
    student_name: str
    essay_id: Optional[str]
    submitted_at: Optional[str]
    total_score: Optional[float]
    max_score: Optional[float]
    teacher_comment: Optional[str]


class TarefaWithSubmissoes(TarefaResponse):
    submissoes: list[SubmissaoItem] = []


class TarefaStudentView(BaseModel):
    """Visão do aluno de uma tarefa."""
    id: str
    title: str
    instructions: Optional[str]
    essay_type: str
    theme: str
    motivating_texts: Optional[list]
    due_date: Optional[str]
    is_ai_generated: bool
    is_closed: bool = False
    created_at: str
    is_past_due: bool
    my_submission: Optional["MinhaSubmissaoView"]


class MinhaSubmissaoView(BaseModel):
    id: str
    essay_id: Optional[str]
    submitted_at: Optional[str]
    total_score: Optional[float]
    max_score: Optional[float]
    teacher_comment: Optional[str]


TarefaStudentView.model_rebuild()


class GenerateThemeRequest(BaseModel):
    essay_type: str = Field(description="'enem' ou 'vestibular'")

    @field_validator("essay_type")
    @classmethod
    def validate_essay_type(cls, v: str) -> str:
        if v not in ("enem", "vestibular"):
            raise ValueError("essay_type deve ser 'enem' ou 'vestibular'")
        return v


class GenerateThemeResponse(BaseModel):
    theme: str
    motivating_texts: list[MotivatingText]


class TeacherCommentRequest(BaseModel):
    comment: str = Field(max_length=1000)

    @field_validator("comment")
    @classmethod
    def sanitize_comment(cls, v: str) -> str:
        return sanitize_essay_text(v)


class TeacherSlotInfo(BaseModel):
    """Informações sobre os slots de alunos do professor."""
    slots_total: int        # 0 = free, >0 = pagou pacote(s)
    slots_used: int         # alunos ativos no total
    slots_free_per_turma: int = 3  # limite por turma no plano free
    is_paid: bool
