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
    feedback: str = Field(max_length=1500)
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


class AIInsights(StrictAIModel):
    general_feedback: str = Field(max_length=1800)
    main_strengths: list[ShortFeedback] = Field(max_length=5)
    priority_improvements: list[ShortFeedback] = Field(max_length=5)
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
