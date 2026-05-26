"""
correction.py — Schemas de resposta de correção

Define a estrutura exata do JSON retornado pela IA e armazenado no banco.
"""
from pydantic import BaseModel


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


class CorrectionInsights(BaseModel):
    """Insights gerais sobre a redação."""

    general_feedback: str               # Feedback geral
    main_strengths: list[str]          # Pontos fortes principais
    priority_improvements: list[str]   # Melhorias prioritárias
    writing_level: str                 # "iniciante" | "intermediário" | "avançado"


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
