"""
essay.py — Schemas para redações

Validação rigorosa de todo conteúdo enviado pelo usuário.
NUNCA confie no frontend — valide tudo no servidor.
"""
from pydantic import BaseModel, Field, field_validator

from app.db.models.essay import EssayType


# Limites de palavras por modelo de redação
ENEM_MIN_WORDS = 100
ENEM_MAX_WORDS = 350   # ENEM aceita até 30 linhas ≈ 350 palavras
VESTIBULAR_MIN_WORDS = 150
VESTIBULAR_MAX_WORDS = 500


class SubmitEssayRequest(BaseModel):
    """
    Dados para submeter uma redação para correção.

    A redação pode ser digitada (text) ou extraída de uma foto (photo).
    Para fotos, o OCR acontece no servidor — o cliente envia apenas a foto.
    """

    title: str = Field(
        min_length=3,
        max_length=200,
        description="Título da redação",
    )

    # Conteúdo da redação — OBRIGATÓRIO para input tipo 'text'
    content: str | None = Field(
        default=None,
        max_length=10000,  # ~10x o tamanho máximo para evitar abuse
        description="Texto da redação (para submissão por texto)",
    )

    essay_type: EssayType = Field(
        description="Modelo: 'enem' ou 'vestibular'",
    )

    # Tema proposto (opcional mas recomendado para avaliação mais precisa)
    theme: str | None = Field(
        default=None,
        max_length=500,
        description="Tema proposto para a redação",
    )

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str | None) -> str | None:
        if v is None:
            return v

        # Remove excesso de espaços/quebras de linha
        cleaned = "\n".join(
            line.strip() for line in v.strip().splitlines() if line.strip()
        )

        # Verifica se há conteúdo real (não só espaços)
        if len(cleaned.replace(" ", "").replace("\n", "")) < 10:
            raise ValueError("O texto da redação está muito curto")

        return cleaned

    @field_validator("title")
    @classmethod
    def sanitize_title(cls, v: str) -> str:
        """Remove caracteres potencialmente perigosos do título."""
        import bleach
        # Bleach remove tags HTML do título
        cleaned = bleach.clean(v.strip(), tags=[], strip=True)
        return cleaned


class EssayResponse(BaseModel):
    """Dados de uma redação para exibição."""

    id: str
    title: str
    essay_type: str
    status: str
    word_count: int | None
    created_at: str

    model_config = {"from_attributes": True}


class EssayDetailResponse(EssayResponse):
    """Dados completos de uma redação, incluindo a correção se disponível."""

    content: str
    theme: str | None
    correction: "CorrectionResponse | None" = None  # type: ignore

    model_config = {"from_attributes": True}


# Import circular resolvido aqui
from app.schemas.correction import CorrectionResponse  # noqa: E402
EssayDetailResponse.model_rebuild()
