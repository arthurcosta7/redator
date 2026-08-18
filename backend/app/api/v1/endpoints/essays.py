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
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db, get_redis
from app.core.job_queue import enqueue_correction
from app.core.logging import get_logger
from app.core.rate_limiter import (
    RateLimiter,
    check_daily_correction_limit,
    release_daily_correction_slot,
    reserve_daily_correction_slot,
)
from app.db.models.essay import Essay, EssayInputType, EssayStatus, EssayType
from app.db.models.tarefa import Tarefa, TarefaSubmissao
from app.db.models.turma import TurmaMembro, TurmaMembroStatus
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
        allowed, _, daily_limit = await reserve_daily_correction_slot(
            user_id=current_user_id,
            plan=current_user.plan.value,
            redis_client=redis_client,
        )
        if not allowed:
            upgrade_message = _get_upgrade_message(current_user.plan.value)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Você atingiu o limite de {daily_limit} correção(ões) por dia. "
                    f"{upgrade_message}"
                ),
            )
        quota_reserved = True

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
    essay_db_id = None
    response_created_at = ""
    try:
        db.add(essay)
        await db.flush()  # Obtém o ID sem commit
        essay_db_id = essay.id
        response_created_at = essay.created_at.isoformat()

        if is_assignment and tarefa:
            # Registra a submissão da tarefa
            from datetime import datetime, timezone
            submissao = TarefaSubmissao(
                tarefa_id=tarefa.id,
                student_id=current_user.id,
                essay_id=essay.id,
                submitted_at=datetime.now(timezone.utc),
            )
            db.add(submissao)
            await db.flush()

        # O worker usa outra conexão e só pode ler dados já confirmados.
        await db.commit()
        await enqueue_correction(str(essay_db_id), is_assignment=is_assignment)
    except Exception as exc:
        await db.rollback()
        if quota_reserved:
            await release_daily_correction_slot(current_user_id, redis_client)
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

    allowed, _, daily_limit = await reserve_daily_correction_slot(
        user_id=current_user_id,
        plan=current_user.plan.value,
        redis_client=redis_client,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Limite diário atingido ({daily_limit}/dia).",
        )

    # Extrai texto via OCR
    try:
        from app.services.ocr.ocr_service import OCRService
        ocr_service = OCRService()
        extracted_text = await ocr_service.extract_text(file_content)
    except Exception as e:
        await release_daily_correction_slot(current_user_id, redis_client)
        logger.error("erro_ocr", error=str(e))
        raise HTTPException(
            status_code=422,
            detail="Não foi possível extrair o texto da foto. "
                   "Verifique se a imagem está nítida e bem iluminada.",
        )

    if not extracted_text or len(extracted_text.strip()) < 50:
        await release_daily_correction_slot(current_user_id, redis_client)
        raise HTTPException(
            status_code=422,
            detail="Não foi possível extrair texto suficiente da imagem. "
                   "Certifique-se que a escrita está legível.",
        )

    word_count = count_words(extracted_text)
    min_words, max_words = _get_word_limits(essay_type)

    if word_count < min_words:
        await release_daily_correction_slot(current_user_id, redis_client)
        raise HTTPException(
            status_code=422,
            detail=f"Texto extraído muito curto ({word_count} palavras). "
                   f"Verifique se a foto capturou toda a redação.",
        )

    if word_count > max_words:
        await release_daily_correction_slot(current_user_id, redis_client)
        raise HTTPException(
            status_code=422,
            detail=f"Texto extraído muito longo ({word_count} palavras).",
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
    essay_db_id = None
    response_created_at = ""
    try:
        db.add(essay)
        await db.flush()
        essay_db_id = essay.id
        response_created_at = essay.created_at.isoformat()
        await db.commit()
        await enqueue_correction(str(essay_db_id))
    except Exception as exc:
        await db.rollback()
        await release_daily_correction_slot(current_user_id, redis_client)
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
        title=title or "Redação sem título",
        essay_type=essay_type.value,
        status=EssayStatus.PENDING.value,
        word_count=word_count,
        created_at=response_created_at,
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
    from datetime import datetime, timezone, timedelta

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
    from sqlalchemy import func

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
        return "Faça upgrade para o plano Pro e tenha 10 correções por dia."
    return ""


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
    from datetime import datetime, timezone

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
    if tarefa.due_date and tarefa.due_date < datetime.now(timezone.utc):
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
