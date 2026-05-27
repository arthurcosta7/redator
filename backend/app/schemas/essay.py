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

    # Tema obrigatório — usado pela IA para avaliar a C2 (ENEM) e adequação ao tema (vestibular)
    theme: str = Field(
        min_length=5,
        max_length=500,
        description="Tema da redação (obrigatório)",
    )

    # Título opcional
    title: str | None = Field(
        default=None,
        max_length=200,
        description="Título da redação (opcional)",
    )

    # Conteúdo da redação — OBRIGATÓRIO para input tipo 'text'
    content: str | None = Field(
        default=None,
        max_length=10000,
        description="Texto da redação (para submissão por texto)",
    )

    essay_type: EssayType = Field(
        description="Modelo: 'enem' ou 'vestibular'",
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
    def sanitize_title(cls, v: str | None) -> str | None:
        """Remove caracteres potencialmente perigosos do título."""
        if v is None:
            return None
        import bleach
        cleaned = bleach.clean(v.strip(), tags=[], strip=True)
        return cleaned or None

    @field_validator("theme")
    @classmethod
    def sanitize_theme(cls, v: str) -> str:
        """Remove tags HTML do tema."""
        import bleach
        cleaned = bleach.clean(v.strip(), tags=[], strip=True)
        if not cleaned:
            raise ValueError("O tema da redação é obrigatório")
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


class EssayListItem(BaseModel):
    """Item na listagem paginada de redações (inclui nota da correção)."""

    id: str
    title: str | None
    essay_type: str
    status: str
    input_type: str
    word_count: int | None
    total_score: float | None
    max_score: float | None
    created_at: str

    model_config = {"from_attributes": True}


class EssayListResponse(BaseModel):
    """Resposta paginada da listagem de redações."""

    items: list[EssayListItem]
    total: int
    page: int
    per_page: int
    has_more: bool


class EssayDetailResponse(EssayResponse):
    """Dados completos de uma redação, incluindo a correção se disponível."""

    content: str
    theme: str | None
    correction: "CorrectionResponse | None" = None  # type: ignore

    model_config = {"from_attributes": True}


# Import circular resolvido aqui
from app.schemas.correction import CorrectionResponse  # noqa: E402
EssayDetailResponse.model_rebuild()
