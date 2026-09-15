"""
essays.py — Endpoints de redações

Rotas:
- POST /essays              — Submete uma nova redação (texto)
- POST /essays/photo        — Submete uma foto para OCR + correção
- GET  /essays              — Lista as redações do usuário
- GET  /essays/{id}         — Detalhe de uma redação
- DELETE /essays/{id}       — Remove uma redação
"""
import asyncio
import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from redis.exceptions import RedisError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db, get_redis
from app.core.job_queue import enqueue_correction
from app.core.logging import get_logger
from app.core.rate_limiter import (
    RateLimiter,
    check_monthly_credits,
    next_month_start,
    release_monthly_credit,
    reserve_monthly_credit,
)
from app.db.models.correction import Correction
from app.db.models.essay import Essay, EssayInputType, EssayStatus, EssayType
from app.db.models.tarefa import Tarefa, TarefaSubmissao
from app.db.models.turma import TurmaMembro, TurmaMembroStatus
from app.db.models.user import User
from app.schemas.essay import (
    EssayDetailResponse,
    EssayListItem,
    EssayListResponse,
    EssayResponse,
    PhotoExtractionResponse,
    SubmitEssayRequest,
)
from app.services.correction_response import (
    build_basic_correction,
    build_full_correction,
)
from app.services.product_analytics import track_product_event
from app.utils.file_validator import validate_image_file
from app.utils.text_sanitizer import sanitize_essay_text, sanitize_short_text

router = APIRouter(prefix="/essays", tags=["Redações"])
logger = get_logger(__name__)
_OCR_REVIEW_TTL_SECONDS = 2 * 60 * 60


def count_words(text: str) -> int:
    """Conta palavras no texto da redação."""
    return len(text.split())


def _ocr_review_key(token: str) -> str:
    """Mantém o token bruto fora do Redis e dos logs."""
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return f"ocr_review:{digest}"


async def _issue_ocr_review_token(
    redis_client: Any,
    user_id: str,
    essay_type: EssayType,
) -> str:
    """Emite prova temporária de que o servidor processou uma foto válida."""
    token = secrets.token_urlsafe(32)
    value = f"{user_id}:{essay_type.value}"
    try:
        await redis_client.set(
            _ocr_review_key(token), value, ex=_OCR_REVIEW_TTL_SECONDS
        )
    except RedisError as exc:
        logger.error("redis_error_ocr_review_token", error_type=type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível iniciar a revisão da transcrição. Tente novamente.",
        ) from exc
    return token


async def _resolve_input_type(
    redis_client: Any,
    token: str | None,
    user_id: str,
    essay_type: EssayType,
) -> EssayInputType:
    """Aceita origem OCR apenas com prova emitida para usuário e modelo atuais."""
    if token is None:
        return EssayInputType.TEXT
    try:
        stored = await redis_client.get(_ocr_review_key(token))
    except RedisError as exc:
        logger.error("redis_error_ocr_review_validation", error_type=type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível validar a transcrição. Tente novamente.",
        ) from exc
    if isinstance(stored, bytes):
        stored = stored.decode("utf-8", errors="replace")
    expected = f"{user_id}:{essay_type.value}"
    if not isinstance(stored, str) or not hmac.compare_digest(stored, expected):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A revisão da foto expirou ou não pertence a esta redação. Extraia a foto novamente.",
        )
    return EssayInputType.PHOTO


async def _consume_ocr_review_token(redis_client: Any, token: str | None) -> None:
    """Invalida o comprovante após a redação ser enfileirada com sucesso."""
    if token is None:
        return
    try:
        await redis_client.delete(_ocr_review_key(token))
    except RedisError as exc:
        # A redação já foi confirmada; a expiração curta limita eventual reuso.
        logger.warning("redis_error_ocr_review_cleanup", error_type=type(exc).__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Submissão de redação por texto
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=EssayResponse, status_code=201)
async def submit_essay(
    data: SubmitEssayRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[Any, Depends(get_redis)],
) -> EssayResponse:
    """
    Submete uma redação em texto para correção.

    Verifica:
    1. Créditos mensais do plano do usuário
    2. Tamanho mínimo/máximo do texto
    3. Sanitização do conteúdo
    """
    if not data.content:
        raise HTTPException(
            status_code=422,
            detail="O texto da redação é obrigatório para envio por texto."
        )

    current_user_id = str(current_user.id)
    limiter = RateLimiter(redis_client)
    if not await limiter.check("essay_submission", current_user_id, 10, 300):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas redações enviadas em pouco tempo. Aguarde alguns minutos.",
        )

    # ── Verifica se é uma entrega de tarefa ──────────────────────────────────
    tarefa: Tarefa | None = None
    is_assignment = False

    if data.assignment_id:
        tarefa, is_assignment = await _validate_assignment_submission(
            assignment_id=data.assignment_id,
            student=current_user,
            db=db,
        )
        # Tarefa define o tema — sobrescreve qualquer tema enviado pelo aluno
        data = data.model_copy(update={"theme": tarefa.theme})

    input_type = await _resolve_input_type(
        redis_client,
        data.ocr_review_token,
        current_user_id,
        data.essay_type,
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

    quota_reserved = False
    if not is_assignment:
        allowed, used, monthly_limit, _ = await reserve_monthly_credit(
            user_id=current_user_id,
            plan=current_user.plan.value,
            redis_client=redis_client,
        )
        if not allowed:
            snapshot = await _build_learning_snapshot(current_user.id, db)
            track_product_event(
                logger, "credit_limit_exceeded", user_id=current_user_id,
                account_type=current_user.user_type.value, plan=current_user.plan.value,
                resource="corrections", used=used, limit=monthly_limit,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=_credit_exhausted_message(snapshot, monthly_limit),
            )
        quota_reserved = True
        track_product_event(
            logger, "credits_used", user_id=current_user_id,
            plan=current_user.plan.value, resource="corrections",
            used=used, limit=monthly_limit,
        )

    # Cria a redação no banco
    essay = Essay(
        user_id=current_user.id,
        title=data.title or "Redação sem título",
        content=data.content,
        theme=data.theme,
        essay_type=data.essay_type,
        input_type=input_type,
        status=EssayStatus.PENDING,
        word_count=word_count,
    )
    essay_db_id = None
    response_created_at = ""
    try:
        db.add(essay)
        await db.flush()  # Obtém o ID sem commit
        essay_db_id = essay.id
        response_created_at = essay.created_at.isoformat()

        if is_assignment and tarefa:
            # Registra a submissão da tarefa
            # UTC explícito evita datas ingênuas nas entregas de tarefas.
            submissao = TarefaSubmissao(
                tarefa_id=tarefa.id,
                student_id=current_user.id,
                essay_id=essay.id,
                submitted_at=datetime.now(UTC),
            )
            db.add(submissao)
            await db.flush()
            track_product_event(
                logger, "assignment_essay_submitted", user_id=current_user_id,
                account_type=current_user.user_type.value,
                essay_type=data.essay_type.value,
            )
        else:
            personal_count = await db.scalar(
                select(func.count(Essay.id)).where(*_personal_essay_filter(current_user.id))
            )
            if personal_count in (1, 2):
                ordinal = "first" if personal_count == 1 else "second"
                track_product_event(
                    logger, f"{ordinal}_essay_submitted", user_id=current_user_id,
                    account_type=current_user.user_type.value, plan=current_user.plan.value,
                    essay_type=data.essay_type.value, sequence=int(personal_count),
                )

        # O worker usa outra conexão e só pode ler dados já confirmados.
        await db.commit()
        await enqueue_correction(str(essay_db_id), is_assignment=is_assignment)
        await _consume_ocr_review_token(redis_client, data.ocr_review_token)
    except Exception as exc:
        await db.rollback()
        if quota_reserved:
            await release_monthly_credit(current_user_id, redis_client)
        if essay_db_id is not None:
            persisted = await db.get(Essay, essay_db_id)
            if persisted is not None:
                persisted.status = EssayStatus.ERROR
                persisted.error_message = "Não foi possível agendar a correção. Tente novamente."
                await db.commit()
        logger.error("erro_enfileirando_correcao", error_type=type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível agendar a correção. Tente novamente.",
        ) from exc

    logger.info(
        "redacao_submetida",
        essay_id=str(essay_db_id),
        user_id=current_user_id,
        essay_type=data.essay_type,
        word_count=word_count,
    )

    return EssayResponse(
        id=str(essay_db_id),
        title=data.title or "Redação sem título",
        essay_type=data.essay_type.value,
        status=EssayStatus.PENDING.value,
        word_count=word_count,
        created_at=response_created_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Submissão de redação por foto (OCR)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/photo/extract", response_model=PhotoExtractionResponse)
async def extract_essay_photo(
    essay_type: Annotated[EssayType, Form()],
    photo: Annotated[UploadFile, File(description="Foto da redação (JPG, PNG, WEBP)")],
    current_user: Annotated[User, Depends(get_current_user)],
    redis_client: Annotated[Any, Depends(get_redis)],
) -> PhotoExtractionResponse:
    """Extrai o texto para revisão do aluno; não cria nem corrige uma redação."""
    current_user_id = str(current_user.id)
    limiter = RateLimiter(redis_client)
    if not await limiter.check("ocr_extraction", current_user_id, 5, 300):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas fotos processadas em pouco tempo. Aguarde alguns minutos.",
        )

    file_content = await photo.read(settings.max_file_size_bytes + 1)
    await photo.close()
    await asyncio.to_thread(
        validate_image_file,
        file_content,
        photo.filename or "",
        photo.content_type or "",
    )

    allowed, _, monthly_limit, _ = await reserve_monthly_credit(
        user_id=current_user_id,
        plan=current_user.plan.value,
        redis_client=redis_client,
        resource="ocr_extractions",
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Seu plano permite até {monthly_limit} leituras de foto por mês.",
        )

    try:
        from app.services.ocr.ocr_service import OCRService

        extracted_text = sanitize_essay_text(await OCRService().extract_text(file_content))
    except Exception as exc:
        await release_monthly_credit(
            current_user_id, redis_client, resource="ocr_extractions"
        )
        logger.error("erro_ocr", error_type=type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="O serviço de leitura da imagem está temporariamente indisponível. "
                   "Tente novamente ou envie a redação digitada.",
        ) from exc

    if not extracted_text or len(extracted_text.strip()) < 50:
        await release_monthly_credit(
            current_user_id, redis_client, resource="ocr_extractions"
        )
        raise HTTPException(
            status_code=422,
            detail="Não foi possível extrair texto suficiente da imagem. "
                   "Certifique-se de que a escrita está legível.",
        )

    word_count = count_words(extracted_text)
    try:
        review_token = await _issue_ocr_review_token(
            redis_client, current_user_id, essay_type
        )
    except HTTPException:
        await release_monthly_credit(
            current_user_id, redis_client, resource="ocr_extractions"
        )
        raise

    track_product_event(
        logger,
        "photo_ocr_extracted",
        user_id=current_user_id,
        account_type=current_user.user_type.value,
        plan=current_user.plan.value,
        essay_type=essay_type.value,
        word_count=word_count,
    )
    return PhotoExtractionResponse(
        content=extracted_text,
        word_count=word_count,
        review_token=review_token,
    )

@router.post("/photo", response_model=EssayResponse, status_code=201)
async def submit_essay_photo(
    theme: Annotated[str, Form(min_length=5, max_length=500)],
    essay_type: Annotated[EssayType, Form()],
    photo: Annotated[UploadFile, File(description="Foto da redação (JPG, PNG, WEBP)")],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[Any, Depends(get_redis)],
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
    current_user_id = str(current_user.id)
    limiter = RateLimiter(redis_client)
    if not await limiter.check("essay_submission", current_user_id, 10, 300):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas redações enviadas em pouco tempo. Aguarde alguns minutos.",
        )

    # Lê no máximo um byte além do limite, sem alocar uploads arbitrariamente grandes.
    file_content = await photo.read(settings.max_file_size_bytes + 1)
    await photo.close()
    await asyncio.to_thread(
        validate_image_file,
        file_content,
        photo.filename or "",
        photo.content_type or "",
    )

    allowed, used, monthly_limit, _ = await reserve_monthly_credit(
        user_id=current_user_id,
        plan=current_user.plan.value,
        redis_client=redis_client,
    )
    if not allowed:
        track_product_event(
            logger, "credit_limit_exceeded", user_id=current_user_id,
            account_type=current_user.user_type.value, plan=current_user.plan.value,
            resource="corrections", used=used, limit=monthly_limit,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Seus {monthly_limit} créditos mensais foram utilizados. Consulte seu plano de evolução para continuar o treino.",
        )
    track_product_event(
        logger, "credits_used", user_id=current_user_id,
        plan=current_user.plan.value, resource="corrections",
        used=used, limit=monthly_limit,
    )

    # Extrai texto via OCR
    try:
        from app.services.ocr.ocr_service import OCRService
        ocr_service = OCRService()
        extracted_text = sanitize_essay_text(await ocr_service.extract_text(file_content))
    except Exception as exc:
        await release_monthly_credit(current_user_id, redis_client)
        logger.error("erro_ocr", error_type=type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="O serviço de leitura da imagem está temporariamente indisponível. "
                   "Tente novamente ou envie a redação digitada.",
        ) from exc

    if not extracted_text or len(extracted_text.strip()) < 50:
        await release_monthly_credit(current_user_id, redis_client)
        raise HTTPException(
            status_code=422,
            detail="Não foi possível extrair texto suficiente da imagem. "
                   "Certifique-se que a escrita está legível.",
        )

    word_count = count_words(extracted_text)
    min_words, max_words = _get_word_limits(essay_type)

    if word_count < min_words:
        await release_monthly_credit(current_user_id, redis_client)
        raise HTTPException(
            status_code=422,
            detail=f"Texto extraído muito curto ({word_count} palavras). "
                   f"Verifique se a foto capturou toda a redação.",
        )

    if word_count > max_words:
        await release_monthly_credit(current_user_id, redis_client)
        raise HTTPException(
            status_code=422,
            detail=f"Texto extraído muito longo ({word_count} palavras).",
        )

    # Cria a redação
    safe_title = sanitize_short_text(title, 200) if title else "Redação sem título"
    safe_theme = sanitize_short_text(theme, 500)
    essay = Essay(
        user_id=current_user.id,
        title=safe_title,
        content=extracted_text,
        theme=safe_theme,
        essay_type=essay_type,
        input_type=EssayInputType.PHOTO,
        status=EssayStatus.PENDING,
        word_count=word_count,
    )
    essay_db_id = None
    response_created_at = ""
    try:
        db.add(essay)
        await db.flush()
        essay_db_id = essay.id
        response_created_at = essay.created_at.isoformat()
        personal_count = await db.scalar(
            select(func.count(Essay.id)).where(*_personal_essay_filter(current_user.id))
        )
        if personal_count in (1, 2):
            ordinal = "first" if personal_count == 1 else "second"
            track_product_event(
                logger, f"{ordinal}_essay_submitted", user_id=current_user_id,
                account_type=current_user.user_type.value, plan=current_user.plan.value,
                essay_type=essay_type.value, sequence=int(personal_count),
            )
        await db.commit()
        await enqueue_correction(str(essay_db_id))
    except Exception as exc:
        await db.rollback()
        await release_monthly_credit(current_user_id, redis_client)
        if essay_db_id is not None:
            persisted = await db.get(Essay, essay_db_id)
            if persisted is not None:
                persisted.status = EssayStatus.ERROR
                persisted.error_message = "Não foi possível agendar a correção. Tente novamente."
                await db.commit()
        logger.error("erro_enfileirando_correcao", error_type=type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível agendar a correção. Tente novamente.",
        ) from exc

    return EssayResponse(
        id=str(essay_db_id),
        title=safe_title,
        essay_type=essay_type.value,
        status=EssayStatus.PENDING.value,
        word_count=word_count,
        created_at=response_created_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Listagem e detalhes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/credits")
async def get_monthly_credits(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[Any, Depends(get_redis)],
) -> dict:
    """Retorna créditos mensais e um resumo pedagógico sem texto pessoal."""
    _, used, monthly_limit, rollover = await check_monthly_credits(
        user_id=str(current_user.id),
        plan=current_user.plan.value,
        redis_client=redis_client,
    )
    snapshot = await _build_learning_snapshot(current_user.id, db)
    return {
        "used": used,
        "limit": monthly_limit,
        "remaining": max(0, monthly_limit - used),
        "rollover": rollover,
        "resets_at": next_month_start().isoformat(),
        **snapshot,
    }


@router.get("/daily-limit", deprecated=True)
async def get_legacy_limit(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client: Annotated[Any, Depends(get_redis)],
) -> dict:
    """Alias temporário: mantém clientes antigos enquanto migram para /credits."""
    return await get_monthly_credits(current_user, db, redis_client)


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
    if current_user.plan.value == "free":
        total = min(total, 5)

    # Busca os itens com a correção (para exibir nota)
    visible_limit = min(per_page, max(0, total - offset))
    essays_result = await db.execute(
        base_query.options(selectinload(Essay.correction))
        .order_by(Essay.created_at.desc()).offset(offset).limit(visible_limit)
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
        first_completed_id = await _first_personal_completed_essay_id(current_user.id, db)
        is_assignment = await db.scalar(
            select(TarefaSubmissao.id).where(TarefaSubmissao.essay_id == essay.id).limit(1)
        ) is not None
        # A primeira correção Free demonstra a experiência completa. As demais
        # mantêm nota por competência, feedback essencial e grifes principais.
        if current_user.plan.value == "free" and essay.id != first_completed_id and not is_assignment:
            correction_data = build_basic_correction(essay.correction)
        else:
            correction_data = build_full_correction(essay.correction)

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


def _personal_essay_filter(user_id: uuid.UUID):
    assignment_essay_ids = select(TarefaSubmissao.essay_id).where(
        TarefaSubmissao.essay_id.isnot(None)
    )
    return (
        Essay.user_id == user_id,
        ~Essay.id.in_(assignment_essay_ids),
    )


async def _first_personal_completed_essay_id(
    user_id: uuid.UUID, db: AsyncSession
) -> uuid.UUID | None:
    """Mantém como demonstração a correção que terminou primeiro, mesmo com jobs paralelos."""
    return await db.scalar(
        select(Essay.id)
        .join(Correction)
        .where(*_personal_essay_filter(user_id), Essay.status == EssayStatus.COMPLETED)
        .order_by(Correction.created_at.asc())
        .limit(1)
    )


async def _build_learning_snapshot(user_id: uuid.UUID, db: AsyncSession) -> dict:
    """Resume evolução apenas com notas; conteúdo da redação nunca entra em logs/analytics."""
    result = await db.execute(
        select(Essay).options(selectinload(Essay.correction)).where(
            *_personal_essay_filter(user_id), Essay.status == EssayStatus.COMPLETED
        ).order_by(Essay.created_at.desc()).limit(2)
    )
    essays = result.scalars().all()
    completed_count = await db.scalar(
        select(func.count(Essay.id)).where(
            *_personal_essay_filter(user_id), Essay.status == EssayStatus.COMPLETED
        )
    ) or 0
    latest = essays[0].correction if essays else None
    previous = essays[1].correction if len(essays) > 1 else None
    weakest = None
    if latest and latest.competencies:
        item = min(
            latest.competencies,
            key=lambda competency: float(competency.get("score", 0)) / max(float(competency.get("max_score", 1)), 1),
        )
        weakest = {"number": item.get("number"), "name": item.get("name", "Competência prioritária")}
    delta = None
    if latest and previous:
        delta = round(latest.score_percentage - previous.score_percentage, 1)
    return {
        "completed_personal_corrections": completed_count,
        "weakest_competency": weakest,
        "latest_score_delta": delta,
    }


def _credit_exhausted_message(snapshot: dict, monthly_limit: int) -> str:
    weakest = snapshot.get("weakest_competency")
    if weakest:
        return (
            f"Você já usou seus {monthly_limit} créditos deste mês. "
            f"A {weakest['name']} ainda é sua prioridade de treino. "
            "Continue no Standard com mais correções e um plano direcionado."
        )
    return (
        f"Você já usou seus {monthly_limit} créditos deste mês. "
        "Continue no Standard para acompanhar sua evolução com um plano direcionado."
    )


async def _validate_assignment_submission(
    assignment_id: str,
    student: User,
    db: AsyncSession,
) -> tuple["Tarefa", bool]:
    """
    Valida que o aluno pode submeter para esta tarefa.

    Verifica:
    1. Tarefa existe
    2. Aluno é membro ACTIVE da turma da tarefa
    3. Prazo não expirou
    4. Aluno ainda não submeteu

    Retorna (tarefa, True) se válido.
    """
    import uuid as _uuid

    try:
        tarefa_uuid = _uuid.UUID(assignment_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    result = await db.execute(
        select(Tarefa).where(Tarefa.id == tarefa_uuid)
    )
    tarefa = result.scalar_one_or_none()
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    # Verifica se a tarefa está fechada
    if tarefa.is_closed:
        raise HTTPException(status_code=403, detail="Esta tarefa foi encerrada pelo professor.")

    # Verifica prazo
    if tarefa.due_date and tarefa.due_date < datetime.now(UTC):
        raise HTTPException(status_code=403, detail="O prazo desta tarefa já encerrou.")

    # Verifica que o aluno é membro ACTIVE da turma
    member_check = await db.execute(
        select(TurmaMembro).where(
            TurmaMembro.turma_id == tarefa.turma_id,
            TurmaMembro.user_id == student.id,
            TurmaMembro.status == TurmaMembroStatus.ACTIVE,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Você não é membro desta turma.")

    # Verifica submissão duplicada
    existing = await db.execute(
        select(TarefaSubmissao).where(
            TarefaSubmissao.tarefa_id == tarefa_uuid,
            TarefaSubmissao.student_id == student.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Você já enviou uma redação para esta tarefa.",
        )

    return tarefa, True
