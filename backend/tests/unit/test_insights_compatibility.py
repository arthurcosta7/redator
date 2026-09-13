"""Compatibilidade dos insights agregados entre versões de correção."""

from app.api.v1.endpoints.insights import _improvement_titles


def test_improvement_titles_accepts_legacy_and_detailed_items():
    assert _improvement_titles(
        [
            "Melhorar a coesão",
            {"title": "Aprofundar o nexo causal", "impact": "texto adicional"},
            {"impact": "objeto inválido sem título"},
            42,
        ]
    ) == ["Melhorar a coesão", "Aprofundar o nexo causal"]
