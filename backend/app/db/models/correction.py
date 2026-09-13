"""
correction.py — Modelo de Correção

Armazena o resultado da análise da IA para uma redação.
Os dados de competências e grifes são serializados como JSON e cifrados
para proteger feedbacks e trechos da redação em repouso.
"""
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.field_encryption import EncryptedJSON
from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.db.models.correction_appeal import CorrectionAppeal
    from app.db.models.essay import Essay


class Correction(UUIDMixin, TimestampMixin, Base):
    """
    Resultado da correção de uma redação.

    Estrutura do campo 'competencies' para ENEM:
    [
      {
        "number": 1,
        "name": "Domínio da língua portuguesa",
        "score": 160,
        "max_score": 200,
        "feedback": "Você demonstra bom domínio...",
        "strengths": ["Vocabulário variado", "Uso correto da pontuação"],
        "improvements": ["Evite repetição de palavras", "Revise a acentuação"]
      },
      ... (5 competências no total)
    ]

    Estrutura do campo 'highlights' (grifes no texto):
    [
      {
        "start": 0,       # Índice de início no texto
        "end": 45,        # Índice de fim no texto
        "text": "A violência urbana tem crescido...",
        "type": "positive",  # positive | negative | suggestion
        "comment": "Boa introdução com contextualização do tema"
      }
    ]

    Estrutura do campo 'insights':
    {
      "general_feedback": "Sua redação demonstra...",
      "main_strengths": [{
        "title": "Tese clara",
        "evidence": "Trecho fiel da redação",
        "explanation": "Por que o trecho funciona",
        "repeat_strategy": "Como repetir o acerto"
      }],
      "priority_improvements": [{
        "title": "Nexo causal incompleto",
        "evidence": "Trecho fiel da redação",
        "impact": "Como o problema afeta a avaliação",
        "how_to_improve": "Procedimento concreto de revisão",
        "rewrite_example": "Exemplo pedagógico de reescrita",
        "practice": "Exercício curto para consolidar"
      }],
      "next_essay_checklist": ["Verificação objetiva para a próxima redação"],
      "writing_level": "intermediário"
    }
    """
    __tablename__ = "corrections"

    # ─── Relacionamento ───────────────────────────────────────────
    essay_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("essays.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,    # Uma redação tem exatamente uma correção
        index=True,
    )

    # Desnormalizado para facilitar queries (evita JOIN para saber quem é o dono)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ─── Pontuação ────────────────────────────────────────────────
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)  # 1000 ENEM, varia Vest.

    # O feedback pode reproduzir trechos pessoais da redação e é cifrado em repouso.
    competencies: Mapped[list] = mapped_column(EncryptedJSON(), nullable=False, default=list)
    highlights: Mapped[list] = mapped_column(EncryptedJSON(), nullable=False, default=list)
    insights: Mapped[dict] = mapped_column(EncryptedJSON(), nullable=False, default=dict)

    # ─── Metadados ────────────────────────────────────────────────
    # Modelo de IA usado (para rastreabilidade)
    ai_model_used: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    prompt_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    openai_response_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cached_input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cache_write_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_cost_usd: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 8), nullable=True
    )
    cache_hit_ratio: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 6), nullable=True
    )
    # Tempo de processamento em segundos
    processing_time_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ─── Relacionamentos ──────────────────────────────────────────
    essay: Mapped["Essay"] = relationship("Essay", back_populates="correction")  # type: ignore
    appeal: Mapped["CorrectionAppeal | None"] = relationship(  # type: ignore
        "CorrectionAppeal", back_populates="correction", uselist=False
    )

    def __repr__(self) -> str:
        return f"<Correction id={self.id} score={self.total_score}/{self.max_score}>"

    @property
    def score_percentage(self) -> float:
        """Retorna a nota como porcentagem (0-100)."""
        if self.max_score == 0:
            return 0
        return round((self.total_score / self.max_score) * 100, 1)
