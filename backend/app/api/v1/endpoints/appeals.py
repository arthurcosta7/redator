"""Fluxo auditavel de contestacao e revisao humana de correcoes."""
import copy
import re
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, get_db, require_admin_role
from app.core.logging import get_logger
from app.db.models.correction import Correction
from app.db.models.correction_appeal import AppealStatus, CorrectionAppeal
from app.db.models.user import AdminRole, User, UserType
from app.schemas.appeal import (
    AppealListResponse,
    AppealResponse,
    CreateAppealRequest,
    ImprovementDatasetItem,
    ResolveAppealRequest,
    ReviewerAppealDetail,
)

router = APIRouter(prefix="/appeals", tags=["Contestacoes"])
logger = get_logger(__name__)
REVIEWER_ROLES = ("licensed_teacher", "superadmin")

_DIRECT_IDENTIFIER_PATTERNS = (
    (re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE), "[EMAIL_REMOVIDO]"),
    (re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"), "[CPF_REMOVIDO]"),
    (
        re.compile(
            r"(?<!\d)(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9?\d{4})[\s.-]*\d{4}(?!\d)"
        ),
        "[TELEFONE_REMOVIDO]",
    ),
    (re.compile(r"https?://\S+", re.IGNORECASE), "[URL_REMOVIDA]"),
    (
        re.compile(
            r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
            re.IGNORECASE,
        ),
        "[IDENTIFICADOR_REMOVIDO]",
    ),
)


def _deidentify(value):
    """Remove identificadores diretos antes de um caso sair da base operacional."""
    if isinstance(value, str):
        for pattern, replacement in _DIRECT_IDENTIFIER_PATTERNS:
            value = pattern.sub(replacement, value)
        return value
    if isinstance(value, list):
        return [_deidentify(item) for item in value]
    if isinstance(value, dict):
        return {key: _deidentify(item) for key, item in value.items()}
    return value


def _uuid_or_404(value: str, resource: str = "Contestacao") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=404, detail=f"{resource} nao encontrada.")


def _appeal_response(appeal: CorrectionAppeal) -> AppealResponse:
    return AppealResponse(
        id=str(appeal.id),
        correction_id=str(appeal.correction_id),
        essay_id=str(appeal.essay_id),
        essay_title=appeal.essay.title,
        essay_type=appeal.essay.essay_type.value,
        status=appeal.status.value,
        student_reason=appeal.student_reason,
        original_total_score=appeal.original_total_score,
        corrected_total_score=appeal.corrected_total_score,
        max_score=appeal.correction.max_score,
        reviewer_explanation=appeal.reviewer_explanation,
        reviewer_name=appeal.reviewer.full_name if appeal.reviewer else None,
        allow_anonymized_improvement=appeal.allow_anonymized_improvement,
        created_at=appeal.created_at,
        reviewed_at=appeal.reviewed_at,
    )


def _reviewer_detail(appeal: CorrectionAppeal) -> ReviewerAppealDetail:
    base = _appeal_response(appeal).model_dump()
    return ReviewerAppealDetail(
        **base,
        essay_theme=appeal.essay.theme,
        essay_content=appeal.essay.content,
        original_competencies=appeal.original_competencies,
        original_highlights=appeal.original_highlights,
        original_insights=appeal.original_insights,
        original_ai_model=appeal.original_ai_model,
    )


def _loaded_appeal_query():
    return select(CorrectionAppeal).options(
        selectinload(CorrectionAppeal.essay),
        selectinload(CorrectionAppeal.correction),
        selectinload(CorrectionAppeal.reviewer),
    )


@router.post("", response_model=AppealResponse, status_code=status.HTTP_201_CREATED)
async def create_appeal(
    body: CreateAppealRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AppealResponse:
    """Aluno contesta uma correcao propria e concluida."""
    if current_user.user_type != UserType.STUDENT:
        raise HTTPException(status_code=403, detail="Apenas alunos podem contestar correcoes.")

    correction_id = _uuid_or_404(body.correction_id, "Correcao")
    result = await db.execute(
        select(Correction)
        .options(selectinload(Correction.essay))
        .where(Correction.id == correction_id, Correction.user_id == current_user.id)
    )
    correction = result.scalar_one_or_none()
    if not correction:
        # Mesmo 404 para inexistente e pertencente a outro aluno (anti-IDOR).
        raise HTTPException(status_code=404, detail="Correcao nao encontrada.")

    appeal = CorrectionAppeal(
        correction_id=correction.id,
        essay_id=correction.essay_id,
        student_id=current_user.id,
        student_reason=body.reason,
        allow_anonymized_improvement=body.allow_anonymized_improvement,
        original_total_score=correction.total_score,
        original_competencies=copy.deepcopy(correction.competencies),
        original_highlights=copy.deepcopy(correction.highlights),
        original_insights=copy.deepcopy(correction.insights),
        original_ai_model=correction.ai_model_used,
    )
    db.add(appeal)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Esta correcao ja possui uma contestacao.",
        )

    result = await db.execute(
        _loaded_appeal_query().where(CorrectionAppeal.id == appeal.id)
    )
    loaded = result.scalar_one()
    logger.info(
        "contestacao_criada",
        appeal_id=str(appeal.id),
        correction_id=str(correction.id),
        student_id=str(current_user.id),
        improvement_consent=body.allow_anonymized_improvement,
    )
    return _appeal_response(loaded)


@router.get("/mine", response_model=AppealListResponse)
async def list_my_appeals(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AppealListResponse:
    result = await db.execute(
        _loaded_appeal_query()
        .where(CorrectionAppeal.student_id == current_user.id)
        .order_by(CorrectionAppeal.created_at.desc())
    )
    items = result.scalars().all()
    return AppealListResponse(items=[_appeal_response(item) for item in items], total=len(items))


@router.get("/review-queue", response_model=AppealListResponse)
async def review_queue(
    reviewer: Annotated[User, Depends(require_admin_role(*REVIEWER_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
    queue_status: str | None = Query(default=None, alias="status"),
) -> AppealListResponse:
    query = _loaded_appeal_query()
    if reviewer.admin_role != AdminRole.SUPERADMIN:
        query = query.where(
            (CorrectionAppeal.status == AppealStatus.PENDING)
            | (CorrectionAppeal.reviewer_id == reviewer.id)
        )
    if queue_status:
        try:
            parsed_status = AppealStatus(queue_status)
        except ValueError:
            raise HTTPException(status_code=422, detail="Status de contestacao invalido.")
        query = query.where(CorrectionAppeal.status == parsed_status)
    else:
        query = query.where(
            (CorrectionAppeal.status == AppealStatus.PENDING)
            | (
                (CorrectionAppeal.status == AppealStatus.IN_REVIEW)
                & (CorrectionAppeal.reviewer_id == reviewer.id)
            )
        )
    result = await db.execute(query.order_by(CorrectionAppeal.created_at.asc()).limit(100))
    items = result.scalars().all()
    return AppealListResponse(items=[_appeal_response(item) for item in items], total=len(items))


@router.get("/improvement-dataset", response_model=list[ImprovementDatasetItem])
async def improvement_dataset(
    _admin: Annotated[User, Depends(require_admin_role("superadmin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=100, ge=1, le=1000),
) -> list[ImprovementDatasetItem]:
    """Exporta apenas exemplos corrigidos e consentidos para evals controlados."""
    result = await db.execute(
        _loaded_appeal_query()
        .where(
            CorrectionAppeal.status == AppealStatus.CORRECTED,
            CorrectionAppeal.training_eligible.is_(True),
        )
        .order_by(CorrectionAppeal.reviewed_at.desc())
        .limit(limit)
    )
    return [
        ImprovementDatasetItem(
            essay_type=item.essay.essay_type.value,
            theme=_deidentify(item.essay.theme),
            essay_content=_deidentify(item.essay.content),
            original_correction=_deidentify({
                "total_score": item.original_total_score,
                "competencies": item.original_competencies,
                "highlights": item.original_highlights,
                "insights": item.original_insights,
                "model": item.original_ai_model,
            }),
            human_correction=_deidentify({
                "total_score": item.corrected_total_score,
                "competencies": item.corrected_competencies,
            }),
            reviewer_explanation=_deidentify(item.reviewer_explanation or ""),
        )
        for item in result.scalars().all()
    ]


@router.post("/{appeal_id}/claim", response_model=ReviewerAppealDetail)
async def claim_appeal(
    appeal_id: str,
    reviewer: Annotated[User, Depends(require_admin_role(*REVIEWER_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReviewerAppealDetail:
    appeal_uuid = _uuid_or_404(appeal_id)
    result = await db.execute(
        _loaded_appeal_query()
        .where(CorrectionAppeal.id == appeal_uuid)
        .with_for_update()
    )
    appeal = result.scalar_one_or_none()
    if not appeal:
        raise HTTPException(status_code=404, detail="Contestacao nao encontrada.")
    if appeal.status == AppealStatus.PENDING:
        appeal.status = AppealStatus.IN_REVIEW
        appeal.reviewer_id = reviewer.id
        await db.flush()
        appeal.reviewer = reviewer
    elif appeal.status != AppealStatus.IN_REVIEW or appeal.reviewer_id != reviewer.id:
        raise HTTPException(status_code=409, detail="Contestacao indisponivel para revisao.")
    return _reviewer_detail(appeal)


@router.get("/{appeal_id}", response_model=ReviewerAppealDetail)
async def get_reviewer_appeal(
    appeal_id: str,
    reviewer: Annotated[User, Depends(require_admin_role(*REVIEWER_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReviewerAppealDetail:
    appeal_uuid = _uuid_or_404(appeal_id)
    result = await db.execute(
        _loaded_appeal_query().where(CorrectionAppeal.id == appeal_uuid)
    )
    appeal = result.scalar_one_or_none()
    if not appeal:
        raise HTTPException(status_code=404, detail="Contestacao nao encontrada.")
    if reviewer.admin_role != AdminRole.SUPERADMIN:
        can_read = appeal.status == AppealStatus.PENDING or appeal.reviewer_id == reviewer.id
        if not can_read:
            # 404 evita confirmar a existencia de um caso fora do escopo do revisor.
            raise HTTPException(status_code=404, detail="Contestacao nao encontrada.")
    return _reviewer_detail(appeal)


@router.post("/{appeal_id}/resolve", response_model=ReviewerAppealDetail)
async def resolve_appeal(
    appeal_id: str,
    body: ResolveAppealRequest,
    reviewer: Annotated[User, Depends(require_admin_role(*REVIEWER_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ReviewerAppealDetail:
    appeal_uuid = _uuid_or_404(appeal_id)
    result = await db.execute(
        _loaded_appeal_query()
        .where(CorrectionAppeal.id == appeal_uuid)
        .with_for_update()
    )
    appeal = result.scalar_one_or_none()
    if not appeal:
        raise HTTPException(status_code=404, detail="Contestacao nao encontrada.")
    if appeal.status != AppealStatus.IN_REVIEW or appeal.reviewer_id != reviewer.id:
        raise HTTPException(status_code=409, detail="Assuma a contestacao antes de decidir.")

    correction = appeal.correction
    if body.decision == "corrected":
        assert body.corrected_total_score is not None
        if body.corrected_total_score > correction.max_score:
            raise HTTPException(status_code=422, detail="A nota excede o maximo da correcao.")

        updated_competencies = copy.deepcopy(correction.competencies)
        if updated_competencies:
            adjustments = {item.number: item.score for item in body.competency_scores or []}
            existing_numbers = {int(item["number"]) for item in updated_competencies}
            if set(adjustments) != existing_numbers:
                raise HTTPException(
                    status_code=422,
                    detail="Informe a nota de todas as competencias avaliadas.",
                )
            for item in updated_competencies:
                number = int(item["number"])
                score = adjustments[number]
                if score > float(item.get("max_score", correction.max_score)):
                    raise HTTPException(
                        status_code=422,
                        detail=f"Nota invalida para a competencia {number}.",
                    )
                item["score"] = score
            calculated_total = sum(float(item["score"]) for item in updated_competencies)
            if abs(calculated_total - body.corrected_total_score) > 0.01:
                raise HTTPException(
                    status_code=422,
                    detail="A soma das competencias deve ser igual a nota final.",
                )

        correction.total_score = body.corrected_total_score
        correction.competencies = updated_competencies
        appeal.status = AppealStatus.CORRECTED
        appeal.corrected_total_score = body.corrected_total_score
        appeal.corrected_competencies = updated_competencies
        appeal.training_eligible = appeal.allow_anonymized_improvement
    else:
        appeal.status = AppealStatus.UPHELD
        appeal.corrected_total_score = appeal.original_total_score
        appeal.corrected_competencies = copy.deepcopy(appeal.original_competencies)
        appeal.training_eligible = False

    appeal.reviewer_explanation = body.explanation
    appeal.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info(
        "contestacao_resolvida",
        appeal_id=str(appeal.id),
        reviewer_id=str(reviewer.id),
        decision=body.decision,
        original_score=appeal.original_total_score,
        final_score=appeal.corrected_total_score,
        training_eligible=appeal.training_eligible,
    )
    return _reviewer_detail(appeal)
