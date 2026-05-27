"""
essays.py — Endpoints de redações

Rotas:
- POST /essays              — Submete uma nova redação (texto)
- POST /essays/photo        — Submete uma foto para OCR + correção
- GET  /essays              — Lista as redações do usuário
- GET  /essays/{id}         — Detalhe de uma redação
- DELETE /essays/{id}       — Remove uma redação
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, get_db, get_redis
from app.core.logging import get_logger
from app.core.rate_limiter import check_daily_correction_limit, increment_daily_correction_count
from app.db.models.essay import Essay, EssayInputType, EssayStatus, EssayType
from app.db.models.user import User
from app.schemas.essay import EssayDetailResponse, EssayListItem, EssayListResponse, EssayResponse, SubmitEssayRequest
from app.utils.file_validator import validate_image_file

router = APIRouter(prefix="/essays", tags=["Redações"])
logger = get_logger(__name__)


def count_words(text: str) -> int:
    """Conta palavras no texto da redação."""
    return len(text.split())


# ─────────────────────────────────────────────────────────────────────────────
# Submissão de redação por texto
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=EssayResponse, status_code=201)
async def submit_essay(
    data: SubmitEssayRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client=Depends(get_redis),
) -> EssayResponse:
    """
    Submete uma redação em texto para correção.

    Verifica:
    1. Limite diário do plano do usuário
    2. Tamanho mínimo/máximo do texto
    3. Sanitização do conteúdo
    """
    if not data.content:
        raise HTTPException(
            status_code=422,
            detail="O texto da redação é obrigatório para envio por texto."
        )

    # Verifica limite diário baseado no plano
    allowed, used_today, daily_limit = await check_daily_correction_limit(
        user_id=str(current_user.id),
        plan=current_user.plan.value,
        redis_client=redis_client,
    )

    if not allowed:
        upgrade_message = _get_upgrade_message(current_user.plan.value)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Você atingiu o limite de {daily_limit} correção(ões) por dia. {upgrade_message}",
        )

    # Valida tamanho do texto
    word_count = count_words(data.content)
    min_words, max_words = _get_word_limits(data.essay_type)

    if word_count < min_words:
        raise HTTPException(
            status_code=422,
            detail=f"Redação muito curta. Mínimo: {min_words} palavras. Atual: {word_count}.",
        )

    if word_count > max_words:
        raise HTTPException(
            status_code=422,
            detail=f"Redação muito longa. Máximo: {max_words} palavras. Atual: {word_count}.",
        )

    # Cria a redação no banco
    essay = Essay(
        user_id=current_user.id,
        title=data.title or "Redação sem título",
        content=data.content,
        theme=data.theme,
        essay_type=data.essay_type,
        input_type=EssayInputType.TEXT,
        status=EssayStatus.PENDING,
        word_count=word_count,
    )
    db.add(essay)
    await db.flush()  # Obtém o ID sem commit

    # Incrementa contador de uso
    await increment_daily_correction_count(str(current_user.id), redis_client)

    # Inicia a correção assíncrona
    await _start_correction(essay, current_user, db)

    logger.info(
        "redacao_submetida",
        essay_id=str(essay.id),
        user_id=str(current_user.id),
        essay_type=data.essay_type,
        word_count=word_count,
    )

    return EssayResponse(
        id=str(essay.id),
        title=essay.title,
        essay_type=essay.essay_type.value,
        status=essay.status.value,
        word_count=essay.word_count,
        created_at=essay.created_at.isoformat(),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Submissão de redação por foto (OCR)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/photo", response_model=EssayResponse, status_code=201)
async def submit_essay_photo(
    theme: Annotated[str, Form(min_length=5, max_length=500)],
    essay_type: Annotated[EssayType, Form()],
    photo: Annotated[UploadFile, File(description="Foto da redação (JPG, PNG, WEBP)")],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client=Depends(get_redis),
    title: Annotated[str | None, Form(max_length=200)] = None,
) -> EssayResponse:
    """
    Processa uma foto de redação usando OCR e depois corrige.

    Segurança de upload de arquivos:
    1. Valida tipo por magic bytes (não só extensão)
    2. Valida tamanho máximo
    3. Não armazena no servidor — processa e descarta
    4. Sanitiza o texto extraído pelo OCR
    """
    # Verifica limite diário
    allowed, used_today, daily_limit = await check_daily_correction_limit(
        user_id=str(current_user.id),
        plan=current_user.plan.value,
        redis_client=redis_client,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Limite diário atingido ({daily_limit}/dia).",
        )

    # Lê o arquivo e valida
    file_content = await photo.read()
    validate_image_file(file_content, photo.filename or "", photo.content_type or "")

    # Extrai texto via OCR
    try:
        from app.services.ocr.ocr_service import OCRService
        ocr_service = OCRService()
        extracted_text = await ocr_service.extract_text(file_content)
    except Exception as e:
        logger.error("erro_ocr", error=str(e))
        raise HTTPException(
            status_code=422,
            detail="Não foi possível extrair o texto da foto. "
                   "Verifique se a imagem está nítida e bem iluminada.",
        )

    if not extracted_text or len(extracted_text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Não foi possível extrair texto suficiente da imagem. "
                   "Certifique-se que a escrita está legível.",
        )

    word_count = count_words(extracted_text)
    min_words, max_words = _get_word_limits(essay_type)

    if word_count < min_words:
        raise HTTPException(
            status_code=422,
            detail=f"Texto extraído muito curto ({word_count} palavras). "
                   f"Verifique se a foto capturou toda a redação.",
        )

    # Cria a redação
    essay = Essay(
        user_id=current_user.id,
        title=title or "Redação sem título",
        content=extracted_text,
        theme=theme,
        essay_type=essay_type,
        input_type=EssayInputType.PHOTO,
        status=EssayStatus.PENDING,
        word_count=word_count,
    )
    db.add(essay)
    await db.flush()

    await increment_daily_correction_count(str(current_user.id), redis_client)
    await _start_correction(essay, current_user, db)

    return EssayResponse(
        id=str(essay.id),
        title=essay.title,
        essay_type=essay.essay_type.value,
        status=essay.status.value,
        word_count=essay.word_count,
        created_at=essay.created_at.isoformat(),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Listagem e detalhes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/daily-limit")
async def get_daily_limit(
    current_user: Annotated[User, Depends(get_current_user)],
    redis_client=Depends(get_redis),
) -> dict:
    """Retorna o uso de correções do dia e o limite do plano."""
    from datetime import date, datetime, timezone, timedelta

    _, used_today, daily_limit = await check_daily_correction_limit(
        user_id=str(current_user.id),
        plan=current_user.plan.value,
        redis_client=redis_client,
    )

    # Próxima meia-noite UTC (quando o limite reseta)
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    return {
        "used": used_today,
        "limit": daily_limit,
        "resets_at": tomorrow.isoformat(),
    }


@router.get("", response_model=EssayListResponse)
async def list_essays(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    per_page: int = 10,
    essay_type: str | None = None,
    status: str | None = None,
) -> EssayListResponse:
    """
    Lista as redações do usuário autenticado com paginação.

    SEGURANÇA IDOR: A query filtra por user_id = current_user.id
    Isso garante que um usuário NUNCA veja redações de outro.
    """
    from sqlalchemy import func, outerjoin
    from app.db.models.correction import Correction

    page = max(1, page)
    per_page = min(max(1, per_page), 50)
    offset = (page - 1) * per_page

    # Base da query com filtro de segurança
    base_query = (
        select(Essay)
        .where(Essay.user_id == current_user.id)  # CRÍTICO: filtra por usuário
    )
    if essay_type:
        base_query = base_query.where(Essay.essay_type == essay_type)
    if status:
        base_query = base_query.where(Essay.status == status)

    # Conta o total
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    # Busca os itens com a correção (para exibir nota)
    essays_result = await db.execute(
        base_query
        .options(selectinload(Essay.correction))
        .order_by(Essay.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    essays = essays_result.scalars().all()

    items = [
        EssayListItem(
            id=str(e.id),
            title=e.title,
            essay_type=e.essay_type.value,
            status=e.status.value,
            input_type=e.input_type.value,
            word_count=e.word_count,
            total_score=e.correction.total_score if e.correction else None,
            max_score=e.correction.max_score if e.correction else None,
            created_at=e.created_at.isoformat(),
        )
        for e in essays
    ]

    return EssayListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(offset + len(items)) < total,
    )


@router.get("/{essay_id}", response_model=EssayDetailResponse)
async def get_essay(
    essay_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EssayDetailResponse:
    """
    Retorna detalhes de uma redação com a correção.

    SEGURANÇA IDOR: Verifica que essay.user_id == current_user.id
    antes de retornar qualquer dado.
    """
    # Valida UUID antes de consultar (evita erros de BD com IDs inválidos)
    try:
        essay_uuid = uuid.UUID(essay_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Redação não encontrada.")

    result = await db.execute(
        select(Essay)
        .where(
            Essay.id == essay_uuid,
            Essay.user_id == current_user.id,  # CRÍTICO: verificação de proprietário
        )
    )
    essay = result.scalar_one_or_none()

    if not essay:
        # SEGURANÇA: Mesmo 404 para "não existe" e "não é seu" — não vaza informação
        raise HTTPException(status_code=404, detail="Redação não encontrada.")

    # Busca a correção se existir
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Essay)
        .options(selectinload(Essay.correction))
        .where(Essay.id == essay_uuid)
    )
    essay = result.scalar_one()

    correction_data = None
    if essay.correction:
        from app.schemas.correction import CorrectionResponse
        # Plano Free recebe versão básica (sem grifes)
        if current_user.plan.value == "free":
            correction_data = _build_basic_correction(essay.correction)
        else:
            correction_data = _build_full_correction(essay.correction)

    return EssayDetailResponse(
        id=str(essay.id),
        title=essay.title,
        essay_type=essay.essay_type.value,
        status=essay.status.value,
        word_count=essay.word_count,
        content=essay.content,
        theme=essay.theme,
        created_at=essay.created_at.isoformat(),
        correction=correction_data,
    )


@router.delete("/{essay_id}", status_code=204)
async def delete_essay(
    essay_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove uma redação e sua correção."""
    try:
        essay_uuid = uuid.UUID(essay_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Redação não encontrada.")

    result = await db.execute(
        select(Essay).where(
            Essay.id == essay_uuid,
            Essay.user_id == current_user.id,  # IDOR check
        )
    )
    essay = result.scalar_one_or_none()

    if not essay:
        raise HTTPException(status_code=404, detail="Redação não encontrada.")

    await db.delete(essay)
    logger.info("redacao_removida", essay_id=essay_id, user_id=str(current_user.id))


# ─────────────────────────────────────────────────────────────────────────────
# Funções auxiliares
# ─────────────────────────────────────────────────────────────────────────────

def _get_word_limits(essay_type: EssayType) -> tuple[int, int]:
    """
    Retorna (mínimo, máximo) de palavras para o tipo de redação.

    ENEM: até 30 linhas manuscritas ≈ 450–500 palavras digitadas.
    Vestibular: varia por banca, geralmente até 30 linhas também.
    """
    if essay_type == EssayType.ENEM:
        return 100, 500
    return 100, 500  # Vestibular


def _get_upgrade_message(plan: str) -> str:
    if plan == "free":
        return "Faça upgrade para o plano Standard e tenha 3 correções por dia."
    elif plan == "standard":
        return "Faça upgrade para o plano Pro e tenha correções ilimitadas."
    return ""


async def _start_correction(essay: Essay, user: User, db: AsyncSession) -> None:
    """
    Inicia o processo de correção pela IA.

    Em uma implementação completa, isso seria processado por uma fila
    (Celery + Redis) para não bloquear a resposta HTTP.
    Por ora, processa de forma assíncrona simples.
    """
    from app.services.ai.correction_service import CorrectionService

    essay.status = EssayStatus.PROCESSING
    await db.flush()

    try:
        service = CorrectionService()
        await service.correct_essay(essay=essay, user=user, db=db)
    except Exception as e:
        logger.error("erro_correcao", essay_id=str(essay.id), error=str(e))
        essay.status = EssayStatus.ERROR
        essay.error_message = "Erro ao processar correção. Tente novamente."


def _build_basic_correction(correction) -> dict:
    """Constrói resposta básica (plano Free) sem grifes."""
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


def _build_full_correction(correction) -> dict:
    """Constrói resposta completa (Standard/Pro) com grifes."""
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
