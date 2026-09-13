"""Monta respostas públicas de correção sem expor metadados internos da IA."""

from typing import Any

from app.db.models.correction import Correction


def build_basic_correction(correction: Correction) -> dict[str, Any]:
    """Retorna a análise básica, sem grifes nem insights premium."""
    return {
        "id": str(correction.id),
        "essay_id": str(correction.essay_id),
        "total_score": correction.total_score,
        "max_score": correction.max_score,
        "score_percentage": correction.score_percentage,
        "competencies": correction.competencies,
        "general_feedback": correction.insights.get("general_feedback", ""),
        "created_at": correction.created_at.isoformat(),
    }


def build_full_correction(correction: Correction) -> dict[str, Any]:
    """Retorna a análise pedagógica completa, incluindo grifes e insights."""
    return {
        "id": str(correction.id),
        "essay_id": str(correction.essay_id),
        "total_score": correction.total_score,
        "max_score": correction.max_score,
        "score_percentage": correction.score_percentage,
        "competencies": correction.competencies,
        "highlights": correction.highlights,
        "insights": correction.insights,
        "created_at": correction.created_at.isoformat(),
    }
