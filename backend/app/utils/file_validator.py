"""
file_validator.py — Validação segura de uploads de arquivo

POR QUE VALIDAR PELO CONTEÚDO (magic bytes) E NÃO PELA EXTENSÃO?
- Um atacante pode renomear um arquivo malicioso para "foto.jpg"
- A extensão é controlada pelo cliente — NUNCA confie nela
- Os "magic bytes" são os primeiros bytes do arquivo, que identificam o tipo real

Assinaturas dos formatos suportados:
- JPEG: FF D8 FF
- PNG:  89 50 4E 47 0D 0A 1A 0A
- WEBP: 52 49 46 46 ... 57 45 42 50
"""
from fastapi import HTTPException

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Magic bytes dos formatos de imagem suportados
IMAGE_SIGNATURES = {
    b"\xff\xd8\xff": "image/jpeg",          # JPEG
    b"\x89PNG\r\n\x1a\n": "image/png",      # PNG
    b"RIFF": "image/webp",                   # WEBP (parcial — verificamos o offset 8 também)
}

MAX_FILE_SIZE = settings.max_file_size_bytes


def validate_image_file(
    file_content: bytes,
    filename: str,
    declared_content_type: str,
) -> None:
    """
    Valida um arquivo de imagem enviado pelo usuário.

    Verificações:
    1. Tamanho do arquivo
    2. Tipo real pelo conteúdo (magic bytes)
    3. Consistência entre tipo declarado e real

    Raises:
        HTTPException 422: Se o arquivo for inválido
    """
    # ─── 1. Verifica tamanho ──────────────────────────────────────
    if len(file_content) == 0:
        raise HTTPException(status_code=422, detail="Arquivo vazio.")

    if len(file_content) > MAX_FILE_SIZE:
        max_mb = settings.MAX_FILE_SIZE_MB
        actual_mb = len(file_content) / (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo muito grande ({actual_mb:.1f}MB). Máximo: {max_mb}MB.",
        )

    # ─── 2. Verifica tipo real pelo conteúdo (magic bytes) ────────
    detected_type = _detect_image_type(file_content)

    if not detected_type:
        raise HTTPException(
            status_code=422,
            detail="Formato de arquivo não suportado. "
                   "Envie uma imagem nos formatos: JPG, PNG ou WEBP.",
        )

    # ─── 3. Verifica consistência ─────────────────────────────────
    allowed_types = settings.ALLOWED_IMAGE_TYPES
    if detected_type not in allowed_types:
        raise HTTPException(
            status_code=422,
            detail=f"Tipo de imagem não permitido: {detected_type}. "
                   f"Use: JPG, PNG ou WEBP.",
        )

    # Verifica se o tipo declarado bate com o detectado
    # (não é crítico mas registramos para monitoramento)
    if declared_content_type and declared_content_type != detected_type:
        logger.warning(
            "tipo_arquivo_inconsistente",
            declared=declared_content_type,
            detected=detected_type,
            filename=filename[-20:] if filename else "",  # Só os últimos 20 chars
        )

    logger.info(
        "arquivo_validado",
        detected_type=detected_type,
        size_bytes=len(file_content),
    )


def _detect_image_type(content: bytes) -> str | None:
    """
    Detecta o tipo de imagem pelos primeiros bytes (magic bytes).

    Retorna o MIME type se reconhecido, None caso contrário.
    """
    if len(content) < 8:
        return None

    # Verifica JPEG
    if content[:3] == b"\xff\xd8\xff":
        return "image/jpeg"

    # Verifica PNG
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"

    # Verifica WEBP (RIFF....WEBP)
    if content[:4] == b"RIFF" and len(content) >= 12 and content[8:12] == b"WEBP":
        return "image/webp"

    return None
