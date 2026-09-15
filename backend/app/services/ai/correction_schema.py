"""Schema estrito da resposta produzida pelo modelo de correção."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictAIModel(BaseModel):
    """Impede que campos inesperados da IA sejam persistidos."""

    model_config = ConfigDict(extra="forbid", strict=True)


CorrectionProfile = Literal["full", "compact"]
ShortFeedback = Annotated[str, Field(min_length=1, max_length=240)]


class AICompetency(StrictAIModel):
    number: int
    name: str = Field(max_length=160)
    score: float
    max_score: float
    feedback: str = Field(min_length=120, max_length=900)
    strengths: list[ShortFeedback] = Field(max_length=2)
    improvements: list[ShortFeedback] = Field(max_length=2)


class CompactAICompetency(StrictAIModel):
    """Pontuação e orientação essencial para correções Free recorrentes."""

    number: int
    name: str = Field(max_length=160)
    score: float
    max_score: float
    feedback: str = Field(min_length=100, max_length=600)


class AIHighlight(StrictAIModel):
    start: int = Field(ge=0)
    end: int = Field(ge=0)
    text: str = Field(max_length=300)
    type: Literal["positive", "negative", "suggestion"]
    comment: str = Field(max_length=280)

    @model_validator(mode="after")
    def validate_range(self) -> "AIHighlight":
        if self.end < self.start:
            raise ValueError("O fim da grife deve ser maior ou igual ao início")
        return self


class AIStrength(StrictAIModel):
    title: str = Field(min_length=5, max_length=120)
    evidence: str = Field(min_length=5, max_length=500)
    explanation: str = Field(min_length=30, max_length=450)
    repeat_strategy: str = Field(min_length=30, max_length=400)


class AIImprovement(StrictAIModel):
    title: str = Field(min_length=5, max_length=120)
    evidence: str = Field(min_length=5, max_length=500)
    impact: str = Field(min_length=30, max_length=450)
    how_to_improve: str = Field(min_length=30, max_length=550)
    rewrite_example: str = Field(min_length=20, max_length=600)
    practice: str = Field(min_length=20, max_length=350)


class AIInsights(StrictAIModel):
    general_feedback: str = Field(min_length=120, max_length=1200)
    main_strengths: list[AIStrength] = Field(max_length=3)
    priority_improvements: list[AIImprovement] = Field(max_length=3)
    next_essay_checklist: list[ShortFeedback] = Field(min_length=2, max_length=4)
    writing_level: Literal["iniciante", "intermediário", "avançado"]


class CorrectionAIResponse(StrictAIModel):
    total_score: float
    competencies: list[AICompetency] = Field(min_length=4, max_length=5)
    highlights: list[AIHighlight] = Field(max_length=7)
    insights: AIInsights
    is_zero: bool
    zero_reason: Annotated[str, Field(min_length=1, max_length=500)] | None


class CompactAIInsights(StrictAIModel):
    """Síntese usada pelo frontend básico sem gerar blocos que serão ocultados."""

    general_feedback: str = Field(min_length=100, max_length=700)


class CompactCorrectionAIResponse(StrictAIModel):
    total_score: float
    competencies: list[CompactAICompetency] = Field(min_length=4, max_length=5)
    highlights: list[AIHighlight] = Field(max_length=3)
    insights: CompactAIInsights
    is_zero: bool
    zero_reason: Annotated[str, Field(min_length=1, max_length=500)] | None


CORRECTION_RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "name": "essay_correction",
    "strict": True,
    "schema": CorrectionAIResponse.model_json_schema(),
}

COMPACT_CORRECTION_RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "name": "essay_correction_compact",
    "strict": True,
    "schema": CompactCorrectionAIResponse.model_json_schema(),
}


def get_correction_response_format(profile: CorrectionProfile) -> dict[str, Any]:
    """Seleciona o menor contrato compatível com a experiência do usuário."""
    if profile == "compact":
        return COMPACT_CORRECTION_RESPONSE_FORMAT
    return CORRECTION_RESPONSE_FORMAT
