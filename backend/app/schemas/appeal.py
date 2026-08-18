"""Contratos da API de contestacao de correcoes."""
from datetime import datetime
import re
from typing import Literal

import bleach
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _sanitize_untrusted_text(value: str) -> str:
    cleaned = bleach.clean(value.strip(), tags=[], strip=True)
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", cleaned)


class StrictRequest(BaseModel):
    """Entradas sensiveis rejeitam campos inesperados e numeros nao finitos."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class CreateAppealRequest(StrictRequest):
    correction_id: str = Field(min_length=36, max_length=36)
    reason: str = Field(min_length=30, max_length=3000)
    allow_anonymized_improvement: bool = False

    @field_validator("reason")
    @classmethod
    def sanitize_reason(cls, value: str) -> str:
        cleaned = _sanitize_untrusted_text(value)
        if len(cleaned) < 30:
            raise ValueError("Explique a contestacao em pelo menos 30 caracteres")
        return cleaned


class CompetencyScoreAdjustment(StrictRequest):
    number: int = Field(ge=1, le=20)
    score: float = Field(ge=0)


class ResolveAppealRequest(StrictRequest):
    decision: Literal["upheld", "corrected"]
    explanation: str = Field(min_length=50, max_length=5000)
    corrected_total_score: float | None = Field(default=None, ge=0)
    competency_scores: list[CompetencyScoreAdjustment] | None = Field(
        default=None, max_length=20
    )

    @field_validator("explanation")
    @classmethod
    def sanitize_explanation(cls, value: str) -> str:
        cleaned = _sanitize_untrusted_text(value)
        if len(cleaned) < 50:
            raise ValueError("A fundamentacao deve ter pelo menos 50 caracteres")
        return cleaned

    @model_validator(mode="after")
    def validate_decision_fields(self) -> "ResolveAppealRequest":
        if self.decision == "corrected" and self.corrected_total_score is None:
            raise ValueError("Informe a nota correta para alterar a correcao")
        if self.decision == "upheld" and (
            self.corrected_total_score is not None or self.competency_scores
        ):
            raise ValueError("Uma correcao mantida nao pode receber uma nova nota")
        if self.competency_scores:
            numbers = [item.number for item in self.competency_scores]
            if len(numbers) != len(set(numbers)):
                raise ValueError("Cada competencia deve aparecer uma unica vez")
        return self


class AppealResponse(BaseModel):
    id: str
    correction_id: str
    essay_id: str
    essay_title: str
    essay_type: str
    status: str
    student_reason: str
    original_total_score: float
    corrected_total_score: float | None
    max_score: float
    reviewer_explanation: str | None
    reviewer_name: str | None
    allow_anonymized_improvement: bool
    created_at: datetime
    reviewed_at: datetime | None


class AppealListResponse(BaseModel):
    items: list[AppealResponse]
    total: int


class ReviewerAppealDetail(AppealResponse):
    essay_theme: str | None
    essay_content: str
    original_competencies: list
    original_highlights: list
    original_insights: dict
    original_ai_model: str | None


class ImprovementDatasetItem(BaseModel):
    essay_type: str
    theme: str | None
    essay_content: str
    original_correction: dict
    human_correction: dict
    reviewer_explanation: str
