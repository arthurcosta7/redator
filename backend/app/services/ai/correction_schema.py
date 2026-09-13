"""Schema estrito da resposta produzida pelo modelo de correção."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictAIModel(BaseModel):
    """Impede que campos inesperados da IA sejam persistidos."""

    model_config = ConfigDict(extra="forbid", strict=True)


ShortFeedback = Annotated[str, Field(min_length=1, max_length=500)]


class AICompetency(StrictAIModel):
    number: int
    name: str = Field(max_length=160)
    score: float
    max_score: float
    feedback: str = Field(min_length=120, max_length=1800)
    strengths: list[ShortFeedback] = Field(max_length=5)
    improvements: list[ShortFeedback] = Field(max_length=5)


class AIHighlight(StrictAIModel):
    start: int = Field(ge=0)
    end: int = Field(ge=0)
    text: str = Field(max_length=500)
    type: Literal["positive", "negative", "suggestion"]
    comment: str = Field(max_length=500)

    @model_validator(mode="after")
    def validate_range(self) -> "AIHighlight":
        if self.end < self.start:
            raise ValueError("O fim da grife deve ser maior ou igual ao início")
        return self


class AIStrength(StrictAIModel):
    title: str = Field(min_length=5, max_length=120)
    evidence: str = Field(min_length=5, max_length=500)
    explanation: str = Field(min_length=30, max_length=700)
    repeat_strategy: str = Field(min_length=30, max_length=600)


class AIImprovement(StrictAIModel):
    title: str = Field(min_length=5, max_length=120)
    evidence: str = Field(min_length=5, max_length=500)
    impact: str = Field(min_length=30, max_length=700)
    how_to_improve: str = Field(min_length=30, max_length=800)
    rewrite_example: str = Field(min_length=20, max_length=900)
    practice: str = Field(min_length=20, max_length=600)


class AIInsights(StrictAIModel):
    general_feedback: str = Field(min_length=120, max_length=2200)
    main_strengths: list[AIStrength] = Field(max_length=4)
    priority_improvements: list[AIImprovement] = Field(max_length=4)
    next_essay_checklist: list[ShortFeedback] = Field(min_length=2, max_length=6)
    writing_level: Literal["iniciante", "intermediário", "avançado"]


class CorrectionAIResponse(StrictAIModel):
    total_score: float
    competencies: list[AICompetency] = Field(min_length=4, max_length=5)
    highlights: list[AIHighlight] = Field(max_length=12)
    insights: AIInsights
    is_zero: bool
    zero_reason: Annotated[str, Field(min_length=1, max_length=500)] | None


CORRECTION_RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "name": "essay_correction",
    "strict": True,
    "schema": CorrectionAIResponse.model_json_schema(),
}
