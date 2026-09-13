"""
correction.py — Schemas de resposta de correção

Define a estrutura exata do JSON retornado pela IA e armazenado no banco.
"""
from pydantic import BaseModel, Field


class CompetencyResult(BaseModel):
    """Resultado de uma competência específica."""

    number: int                         # Número da competência (1-5 no ENEM)
    name: str                           # Nome da competência
    score: float                        # Pontuação obtida
    max_score: float                    # Pontuação máxima
    feedback: str                       # Análise detalhada
    strengths: list[str]               # O que foi bem
    improvements: list[str]            # O que melhorar


class TextHighlight(BaseModel):
    """
    Marcação de trecho no texto (grife).

    Indica partes boas (verde), ruins (vermelho) ou neutras (amarelo)
    diretamente no texto da redação.
    """

    start: int                          # Posição inicial no texto (índice de caracter)
    end: int                            # Posição final no texto
    text: str                           # Trecho do texto
    type: str                           # "positive" | "negative" | "suggestion"
    comment: str                        # Comentário sobre o trecho


class StrengthInsight(BaseModel):
    title: str
    evidence: str
    explanation: str
    repeat_strategy: str


class ImprovementInsight(BaseModel):
    title: str
    evidence: str
    impact: str
    how_to_improve: str
    rewrite_example: str
    practice: str


class CorrectionInsights(BaseModel):
    """Insights gerais sobre a redação."""

    general_feedback: str               # Feedback geral
    main_strengths: list[str | StrengthInsight] = Field(default_factory=list)
    priority_improvements: list[str | ImprovementInsight] = Field(default_factory=list)
    next_essay_checklist: list[str] = Field(default_factory=list)
    writing_level: str = "não informado"


class CorrectionResponse(BaseModel):
    """Resposta completa de uma correção."""

    id: str
    essay_id: str
    total_score: float
    max_score: float
    score_percentage: float
    competencies: list[CompetencyResult]
    highlights: list[TextHighlight]
    insights: CorrectionInsights
    created_at: str

    model_config = {"from_attributes": True}


class BasicCorrectionResponse(BaseModel):
    """
    Resposta simplificada para plano Free.

    O plano Free recebe análise por competências mas sem grifes no texto.
    """

    id: str
    essay_id: str
    total_score: float
    max_score: float
    score_percentage: float
    competencies: list[CompetencyResult]  # Análise básica por competência
    general_feedback: str                  # Feedback geral (sem grifes)
    created_at: str

    model_config = {"from_attributes": True}
