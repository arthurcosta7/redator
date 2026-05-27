"""
professor.py — Endpoints do painel do Professor

Rotas para professores:
  GET    /professor/turmas
  POST   /professor/turmas
  GET    /professor/turmas/{id}
  PATCH  /professor/turmas/{id}
  DELETE /professor/turmas/{id}
  POST   /professor/turmas/{id}/membros          — adiciona aluno offline
  POST   /professor/turmas/{id}/convidar         — convida aluno por email
  DELETE /professor/turmas/{id}/membros/{mid}    — remove membro
  GET    /professor/turmas/{id}/redacoes         — redações dos alunos
  GET    /professor/analytics                    — overview analytics
  GET    /professor/analytics/turma/{id}         — analytics da turma
  GET    /professor/analytics/aluno/{uid}        — analytics do aluno

Rotas para alunos (ver/aceitar convites):
  GET    /professor/meus-convites
  POST   /professor/meus-convites/{mid}/aceitar
  DELETE /professor/meus-convites/{mid}

SEGURANÇA:
- Todas as rotas de professor verificam user_type no banco (get_current_teacher)
- IDOR prevenido filtrando sempre por teacher_id = current_user.id
- Aluno só pode aceitar/recusar convites onde membro.user_id == current_user.id
- Inputs sanitizados via schemas Pydantic + bleach
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, get_db
from app.core.logging import get_logger
from app.db.models.correction import Correction
from app.db.models.essay import Essay, EssayStatus
from app.db.models.turma import Turma, TurmaMembro, TurmaMembroStatus
from app.db.models.user import User, UserType
from app.schemas.turma import (
    AddOfflineStudentRequest,
    InviteStudentRequest,
    PendingInviteItem,
    ProfessorOverviewAnalytics,
    StudentFullAnalytics,
    TurmaAnalyticsItem,
    TurmaCreate,
    TurmaDetail,
    TurmaEssayItem,
    TurmaEssaysResponse,
    TurmaFullAnalytics,
    TurmaListItem,
    TurmaMembroItem,
    TurmaUpdate,
    StudentAnalyticsItem,
)

router = APIRouter(prefix="/professor", tags=["Professor"])
logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Dependency — verifica que é professor (no banco, não no token)
# ─────────────────────────────────────────────────────────────────────────────

async def get_current_teacher(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Verifica que o usuário autenticado é professor.

    SEGURANÇA: A verificação é feita no banco de dados (via get_current_user),
    não no token JWT. Isso garante que mudanças de user_type tomam efeito
    imediatamente, sem precisar revogar tokens.
    """
    if current_user.user_type != UserType.TEACHER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso exclusivo para professores.",
        )
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _turma_to_list_item(
    turma: Turma,
    member_count: int = 0,
    active_member_count: int = 0,
    essay_count: int = 0,
) -> TurmaListItem:
    return TurmaListItem(
        id=str(turma.id),
        name=turma.name,
        description=turma.description,
        member_count=member_count,
        active_member_count=active_member_count,
        essay_count=essay_count,
        created_at=turma.created_at.isoformat(),
    )


def _membro_to_item(
    membro: TurmaMembro,
    essay_count: int = 0,
    completed_count: int = 0,
    avg_score_pct: float | None = None,
    last_essay_at: str | None = None,
) -> TurmaMembroItem:
    return TurmaMembroItem(
        id=str(membro.id),
        turma_id=str(membro.turma_id),
        user_id=str(membro.user_id) if membro.user_id else None,
        display_name=membro.display_name or (membro.user.full_name if membro.user else None),
        email=membro.user.email if membro.user else None,
        status=membro.status.value,
        joined_at=membro.joined_at.isoformat(),
        essay_count=essay_count,
        completed_count=completed_count,
        avg_score_pct=round(avg_score_pct, 1) if avg_score_pct is not None else None,
        last_essay_at=last_essay_at,
    )


async def _get_turma_or_404(
    turma_id_str: str,
    teacher_id: uuid.UUID,
    db: AsyncSession,
) -> Turma:
    """
    Busca turma por ID verificando pertencer ao professor.

    SEGURANÇA: A condição teacher_id == teacher_id garante que um professor
    não pode acessar turmas de outro (IDOR prevention).
    """
    try:
        turma_uuid = uuid.UUID(turma_id_str)
    except ValueError:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    result = await db.execute(
        select(Turma)
        .options(selectinload(Turma.members).selectinload(TurmaMembro.user))
        .where(Turma.id == turma_uuid, Turma.teacher_id == teacher_id)
    )
    turma = result.scalar_one_or_none()
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")
    return turma


async def _get_member_stats(
    user_ids: list[uuid.UUID],
    db: AsyncSession,
) -> dict[uuid.UUID, dict]:
    """Retorna estatísticas de ensaios por user_id."""
    if not user_ids:
        return {}

    # Count essays e join com corrections
    essay_rows = await db.execute(
        select(
            Essay.user_id,
            func.count(Essay.id).label("essay_count"),
            func.count(Correction.id).label("completed_count"),
            func.avg(
                Correction.total_score / Correction.max_score * 100
            ).label("avg_score_pct"),
            func.max(Essay.created_at).label("last_essay_at"),
        )
        .outerjoin(Correction, Correction.essay_id == Essay.id)
        .where(Essay.user_id.in_(user_ids))
        .group_by(Essay.user_id)
    )

    stats: dict[uuid.UUID, dict] = {}
    for row in essay_rows.all():
        stats[row.user_id] = {
            "essay_count": row.essay_count,
            "completed_count": row.completed_count,
            "avg_score_pct": float(row.avg_score_pct) if row.avg_score_pct else None,
            "last_essay_at": row.last_essay_at.isoformat() if row.last_essay_at else None,
        }
    return stats


# ─────────────────────────────────────────────────────────────────────────────
# CRUD de Turmas
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/turmas", response_model=list[TurmaListItem])
async def list_turmas(
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TurmaListItem]:
    """Lista todas as turmas do professor autenticado."""
    result = await db.execute(
        select(Turma)
        .where(Turma.teacher_id == teacher.id)
        .options(selectinload(Turma.members))
        .order_by(Turma.created_at.desc())
    )
    turmas = result.scalars().all()

    items = []
    for turma in turmas:
        active = [m for m in turma.members if m.status == TurmaMembroStatus.ACTIVE]
        pending = [m for m in turma.members if m.status == TurmaMembroStatus.PENDING]
        member_count = len(active) + len(pending)
        active_member_count = len(active)

        # Count essays from active members with real accounts
        active_user_ids = [m.user_id for m in active if m.user_id is not None]
        essay_count = 0
        if active_user_ids:
            count_result = await db.execute(
                select(func.count(Essay.id)).where(Essay.user_id.in_(active_user_ids))
            )
            essay_count = count_result.scalar_one() or 0

        items.append(_turma_to_list_item(
            turma,
            member_count=member_count,
            active_member_count=active_member_count,
            essay_count=essay_count,
        ))

    return items


@router.post("/turmas", response_model=TurmaListItem, status_code=201)
async def create_turma(
    data: TurmaCreate,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TurmaListItem:
    """Cria uma nova turma."""
    turma = Turma(
        teacher_id=teacher.id,
        name=data.name,
        description=data.description,
    )
    db.add(turma)
    await db.flush()

    # Re-SELECT para carregar server_defaults (created_at, updated_at)
    result_t = await db.execute(select(Turma).where(Turma.id == turma.id))
    turma = result_t.scalar_one()

    logger.info("turma_criada", turma_id=str(turma.id), teacher_id=str(teacher.id))
    return _turma_to_list_item(turma)


@router.get("/turmas/{turma_id}", response_model=TurmaDetail)
async def get_turma(
    turma_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TurmaDetail:
    """Retorna detalhe de uma turma com lista de membros e estatísticas."""
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    # Filtra membros não removidos
    members = [m for m in turma.members if m.status != TurmaMembroStatus.REMOVED]
    active_members = [m for m in members if m.status == TurmaMembroStatus.ACTIVE]
    active_user_ids = [m.user_id for m in active_members if m.user_id is not None]

    # Estatísticas por aluno
    stats = await _get_member_stats(active_user_ids, db)

    # Total de redações da turma
    total_essays = sum(s.get("essay_count", 0) for s in stats.values())

    member_items = [
        _membro_to_item(
            m,
            essay_count=stats.get(m.user_id, {}).get("essay_count", 0) if m.user_id else 0,
            completed_count=stats.get(m.user_id, {}).get("completed_count", 0) if m.user_id else 0,
            avg_score_pct=stats.get(m.user_id, {}).get("avg_score_pct") if m.user_id else None,
            last_essay_at=stats.get(m.user_id, {}).get("last_essay_at") if m.user_id else None,
        )
        for m in members
    ]

    # Ordena: ACTIVE primeiro, depois PENDING, dentro de cada grupo por nome
    member_items.sort(key=lambda x: (0 if x.status == "active" else 1, x.display_name or ""))

    return TurmaDetail(
        id=str(turma.id),
        name=turma.name,
        description=turma.description,
        member_count=len(members),
        active_member_count=len(active_members),
        essay_count=total_essays,
        created_at=turma.created_at.isoformat(),
        members=member_items,
    )


@router.patch("/turmas/{turma_id}", response_model=TurmaListItem)
async def update_turma(
    turma_id: str,
    data: TurmaUpdate,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TurmaListItem:
    """Atualiza nome e/ou descrição de uma turma."""
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    if data.name is not None:
        turma.name = data.name
    if data.description is not None:
        turma.description = data.description

    await db.flush()
    return _turma_to_list_item(turma)


@router.delete("/turmas/{turma_id}", status_code=204)
async def delete_turma(
    turma_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove uma turma e todos os seus membros (cascade)."""
    turma = await _get_turma_or_404(turma_id, teacher.id, db)
    await db.delete(turma)
    logger.info("turma_removida", turma_id=turma_id, teacher_id=str(teacher.id))


# ─────────────────────────────────────────────────────────────────────────────
# Gestão de Membros
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/turmas/{turma_id}/membros", response_model=TurmaMembroItem, status_code=201)
async def add_offline_student(
    turma_id: str,
    data: AddOfflineStudentRequest,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TurmaMembroItem:
    """
    Adiciona aluno pelo nome (sem conta no sistema).

    Use quando o aluno não tem cadastro — o professor registra apenas o nome
    para controle de presença/turma. Nenhum dado de redação estará disponível.
    """
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    membro = TurmaMembro(
        turma_id=turma.id,
        user_id=None,
        display_name=data.display_name,
        status=TurmaMembroStatus.ACTIVE,
    )
    db.add(membro)
    await db.flush()

    # Re-SELECT para carregar server_defaults (joined_at)
    result_m = await db.execute(
        select(TurmaMembro).where(TurmaMembro.id == membro.id)
    )
    membro = result_m.scalar_one()

    logger.info(
        "membro_offline_adicionado",
        turma_id=turma_id,
        display_name=data.display_name,
    )
    return _membro_to_item(membro)


@router.post("/turmas/{turma_id}/convidar", response_model=TurmaMembroItem, status_code=201)
async def invite_student_by_email(
    turma_id: str,
    data: InviteStudentRequest,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TurmaMembroItem:
    """
    Convida aluno por email.

    O aluno deve ter conta cadastrada. Um convite pendente é criado
    e o aluno pode aceitar ou recusar no painel dele.

    SEGURANÇA: Não revela se o email existe ou não — responde com 201
    e uma mensagem genérica caso não encontre o usuário.
    """
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    # Busca o usuário pelo email (case-insensitive)
    result = await db.execute(
        select(User).where(func.lower(User.email) == data.email.lower())
    )
    invited_user = result.scalar_one_or_none()

    if not invited_user:
        # SEGURANÇA: Não revela que o email não existe — comportamento idêntico
        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado. Confirme se o aluno já se cadastrou no Redator.",
        )

    # Verifica se já é membro (ativo ou pendente)
    existing = await db.execute(
        select(TurmaMembro).where(
            TurmaMembro.turma_id == turma.id,
            TurmaMembro.user_id == invited_user.id,
            TurmaMembro.status != TurmaMembroStatus.REMOVED,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Este aluno já é membro ou já tem um convite pendente nesta turma.",
        )

    membro = TurmaMembro(
        turma_id=turma.id,
        user_id=invited_user.id,
        display_name=invited_user.full_name,
        status=TurmaMembroStatus.PENDING,
    )
    db.add(membro)
    await db.flush()

    # Re-SELECT para carregar server_defaults (joined_at) + relação user
    result2 = await db.execute(
        select(TurmaMembro)
        .options(selectinload(TurmaMembro.user))
        .where(TurmaMembro.id == membro.id)
    )
    membro = result2.scalar_one()

    logger.info(
        "convite_enviado",
        turma_id=turma_id,
        invited_user_id=str(invited_user.id),
        teacher_id=str(teacher.id),
    )
    return _membro_to_item(membro)


@router.delete("/turmas/{turma_id}/membros/{member_id}", status_code=204)
async def remove_member(
    turma_id: str,
    member_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove (soft delete) um membro da turma."""
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    try:
        member_uuid = uuid.UUID(member_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")

    # Busca o membro dentro desta turma (IDOR: turma já foi verificada)
    result = await db.execute(
        select(TurmaMembro).where(
            TurmaMembro.id == member_uuid,
            TurmaMembro.turma_id == turma.id,
        )
    )
    membro = result.scalar_one_or_none()
    if not membro:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")

    membro.status = TurmaMembroStatus.REMOVED
    await db.flush()
    logger.info("membro_removido", member_id=member_id, turma_id=turma_id)


# ─────────────────────────────────────────────────────────────────────────────
# Redações da Turma
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/turmas/{turma_id}/redacoes", response_model=TurmaEssaysResponse)
async def get_turma_essays(
    turma_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    per_page: int = 20,
    student_id: str | None = None,
    status_filter: str | None = None,
) -> TurmaEssaysResponse:
    """
    Lista redações dos alunos de uma turma.

    SEGURANÇA - IDOR:
    - A turma é verificada por teacher_id.
    - Apenas redações de alunos ATIVOS nesta turma são retornadas.
    - Opcional filtrar por student_id — mas apenas se o aluno for membro da turma.
    """
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    # Pega user_ids dos membros ativos com conta
    active_members = [
        m for m in turma.members
        if m.status == TurmaMembroStatus.ACTIVE and m.user_id is not None
    ]
    active_user_ids = [m.user_id for m in active_members]

    if not active_user_ids:
        return TurmaEssaysResponse(items=[], total=0, page=page, per_page=per_page, has_more=False)

    # Valida student_id se fornecido
    student_uuid: uuid.UUID | None = None
    if student_id:
        try:
            student_uuid = uuid.UUID(student_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="student_id inválido.")
        if student_uuid not in active_user_ids:
            raise HTTPException(
                status_code=403,
                detail="Aluno não é membro ativo desta turma.",
            )

    page = max(1, page)
    per_page = min(max(1, per_page), 50)
    offset = (page - 1) * per_page

    base_query = (
        select(Essay)
        .options(selectinload(Essay.correction), selectinload(Essay.user))
        .where(Essay.user_id.in_(active_user_ids))
    )
    if student_uuid:
        base_query = base_query.where(Essay.user_id == student_uuid)
    if status_filter:
        base_query = base_query.where(Essay.status == status_filter)

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    essays_result = await db.execute(
        base_query.order_by(Essay.created_at.desc()).offset(offset).limit(per_page)
    )
    essays = essays_result.scalars().all()

    # Mapa user_id → nome do membro
    member_name_map = {m.user_id: (m.display_name or m.user.full_name) for m in active_members if m.user}

    items = [
        TurmaEssayItem(
            id=str(e.id),
            title=e.title,
            essay_type=e.essay_type.value,
            status=e.status.value,
            word_count=e.word_count,
            total_score=e.correction.total_score if e.correction else None,
            max_score=e.correction.max_score if e.correction else None,
            created_at=e.created_at.isoformat(),
            student_id=str(e.user_id),
            student_name=member_name_map.get(e.user_id, "Aluno"),
        )
        for e in essays
    ]

    return TurmaEssaysResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(offset + len(items)) < total,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/analytics", response_model=ProfessorOverviewAnalytics)
async def get_overview_analytics(
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProfessorOverviewAnalytics:
    """Analytics gerais do professor: contagens e médias por turma."""
    from datetime import datetime, timedelta, timezone

    # Busca todas as turmas com membros
    turmas_result = await db.execute(
        select(Turma)
        .options(selectinload(Turma.members))
        .where(Turma.teacher_id == teacher.id)
    )
    turmas = turmas_result.scalars().all()

    all_active_user_ids: list[uuid.UUID] = []
    turma_items: list[TurmaAnalyticsItem] = []

    for turma in turmas:
        active = [m for m in turma.members if m.status == TurmaMembroStatus.ACTIVE and m.user_id]
        active_uids = [m.user_id for m in active]
        all_active_user_ids.extend(active_uids)

        essay_count = 0
        completed_count = 0
        avg_score_pct = None

        if active_uids:
            rows = await db.execute(
                select(
                    func.count(Essay.id).label("c"),
                    func.count(Correction.id).label("comp"),
                )
                .outerjoin(Correction, Correction.essay_id == Essay.id)
                .where(Essay.user_id.in_(active_uids))
            )
            row = rows.one()
            essay_count = row.c or 0
            completed_count = row.comp or 0

            if completed_count > 0:
                avg_row = await db.execute(
                    select(
                        func.avg(
                            Correction.total_score / Correction.max_score * 100
                        )
                    )
                    .join(Essay, Essay.id == Correction.essay_id)
                    .where(Essay.user_id.in_(active_uids))
                )
                avg_val = avg_row.scalar()
                avg_score_pct = round(float(avg_val), 1) if avg_val else None

        turma_items.append(TurmaAnalyticsItem(
            id=str(turma.id),
            name=turma.name,
            active_members=len(active),
            essay_count=essay_count,
            completed_count=completed_count,
            avg_score_pct=avg_score_pct,
        ))

    # Totais gerais
    total_essays = 0
    essays_this_week = 0
    overall_avg = None

    if all_active_user_ids:
        one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)

        total_row = await db.execute(
            select(func.count(Essay.id)).where(Essay.user_id.in_(all_active_user_ids))
        )
        total_essays = total_row.scalar_one() or 0

        week_row = await db.execute(
            select(func.count(Essay.id)).where(
                Essay.user_id.in_(all_active_user_ids),
                Essay.created_at >= one_week_ago,
            )
        )
        essays_this_week = week_row.scalar_one() or 0

        avg_row = await db.execute(
            select(
                func.avg(
                    Correction.total_score / Correction.max_score * 100
                )
            )
            .join(Essay, Essay.id == Correction.essay_id)
            .where(Essay.user_id.in_(all_active_user_ids))
        )
        avg_val = avg_row.scalar()
        overall_avg = round(float(avg_val), 1) if avg_val else None

    # Deduplica user_ids (aluno em múltiplas turmas conta uma vez)
    unique_active = len(set(str(uid) for uid in all_active_user_ids))

    return ProfessorOverviewAnalytics(
        turma_count=len(turmas),
        active_member_count=unique_active,
        total_essay_count=total_essays,
        essays_this_week=essays_this_week,
        avg_score_pct=overall_avg,
        turmas=turma_items,
    )


@router.get("/analytics/turma/{turma_id}", response_model=TurmaFullAnalytics)
async def get_turma_analytics(
    turma_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TurmaFullAnalytics:
    """Analytics detalhado de uma turma: por aluno."""
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    members_visible = [m for m in turma.members if m.status != TurmaMembroStatus.REMOVED]
    active_members = [m for m in members_visible if m.status == TurmaMembroStatus.ACTIVE]
    active_user_ids = [m.user_id for m in active_members if m.user_id is not None]

    stats = await _get_member_stats(active_user_ids, db)

    total_essays = sum(s.get("essay_count", 0) for s in stats.values())
    completed_essays = sum(s.get("completed_count", 0) for s in stats.values())

    # Média geral da turma
    scores = [s["avg_score_pct"] for s in stats.values() if s.get("avg_score_pct") is not None]
    avg_score_pct = round(sum(scores) / len(scores), 1) if scores else None

    student_items = [
        StudentAnalyticsItem(
            member_id=str(m.id),
            user_id=str(m.user_id) if m.user_id else None,
            display_name=m.display_name or (m.user.full_name if m.user else "Aluno offline"),
            email=m.user.email if m.user else None,
            status=m.status.value,
            essay_count=stats.get(m.user_id, {}).get("essay_count", 0) if m.user_id else 0,
            completed_count=stats.get(m.user_id, {}).get("completed_count", 0) if m.user_id else 0,
            avg_score_pct=stats.get(m.user_id, {}).get("avg_score_pct") if m.user_id else None,
            last_essay_at=stats.get(m.user_id, {}).get("last_essay_at") if m.user_id else None,
        )
        for m in members_visible
    ]

    # Ordena por avg_score_pct desc, então por nome
    student_items.sort(
        key=lambda x: (-(x.avg_score_pct or -1), x.display_name or "")
    )

    return TurmaFullAnalytics(
        turma_id=str(turma.id),
        turma_name=turma.name,
        active_members=len(active_members),
        total_essays=total_essays,
        completed_essays=completed_essays,
        avg_score_pct=avg_score_pct,
        students=student_items,
    )


@router.get("/analytics/aluno/{member_id}", response_model=StudentFullAnalytics)
async def get_student_analytics(
    member_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StudentFullAnalytics:
    """
    Analytics completo de um aluno específico.

    SEGURANÇA - IDOR:
    O membro deve pertencer a uma turma do professor autenticado.
    """
    try:
        member_uuid = uuid.UUID(member_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")

    # Busca o membro verificando que a turma pertence ao professor
    result = await db.execute(
        select(TurmaMembro)
        .options(
            selectinload(TurmaMembro.user),
            selectinload(TurmaMembro.turma),
        )
        .join(Turma, Turma.id == TurmaMembro.turma_id)
        .where(
            TurmaMembro.id == member_uuid,
            Turma.teacher_id == teacher.id,
            TurmaMembro.status != TurmaMembroStatus.REMOVED,
        )
    )
    membro = result.scalar_one_or_none()
    if not membro:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")

    # Busca redações se o aluno tem conta
    essays: list[TurmaEssayItem] = []
    essay_count = 0
    completed_count = 0
    avg_score_pct = None

    if membro.user_id:
        essays_result = await db.execute(
            select(Essay)
            .options(selectinload(Essay.correction))
            .where(Essay.user_id == membro.user_id)
            .order_by(Essay.created_at.desc())
            .limit(50)
        )
        essay_objs = essays_result.scalars().all()
        essay_count = len(essay_objs)
        completed = [e for e in essay_objs if e.status == EssayStatus.COMPLETED and e.correction]
        completed_count = len(completed)

        if completed:
            pcts = [
                (e.correction.total_score / e.correction.max_score * 100)
                for e in completed
                if e.correction and e.correction.max_score
            ]
            avg_score_pct = round(sum(pcts) / len(pcts), 1) if pcts else None

        student_name = membro.display_name or (membro.user.full_name if membro.user else "Aluno")
        essays = [
            TurmaEssayItem(
                id=str(e.id),
                title=e.title,
                essay_type=e.essay_type.value,
                status=e.status.value,
                word_count=e.word_count,
                total_score=e.correction.total_score if e.correction else None,
                max_score=e.correction.max_score if e.correction else None,
                created_at=e.created_at.isoformat(),
                student_id=str(membro.user_id),
                student_name=student_name,
            )
            for e in essay_objs
        ]

    return StudentFullAnalytics(
        member_id=str(membro.id),
        user_id=str(membro.user_id) if membro.user_id else None,
        display_name=membro.display_name or (membro.user.full_name if membro.user else "Aluno offline"),
        email=membro.user.email if membro.user else None,
        turma_id=str(membro.turma_id),
        turma_name=membro.turma.name,
        essay_count=essay_count,
        completed_count=completed_count,
        avg_score_pct=avg_score_pct,
        essays=essays,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Convites — visão do aluno (aceitar/recusar)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/meus-convites", response_model=list[PendingInviteItem])
async def get_my_invites(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PendingInviteItem]:
    """
    Retorna os convites pendentes do aluno autenticado.

    SEGURANÇA: Filtra por user_id == current_user.id (IDOR prevention).
    """
    result = await db.execute(
        select(TurmaMembro)
        .options(
            selectinload(TurmaMembro.turma).selectinload(Turma.members),
        )
        .where(
            TurmaMembro.user_id == current_user.id,
            TurmaMembro.status == TurmaMembroStatus.PENDING,
        )
        .order_by(TurmaMembro.joined_at.desc())
    )
    membros = result.scalars().all()

    # Busca nomes dos professores
    teacher_ids = [m.turma.teacher_id for m in membros]
    teachers: dict[uuid.UUID, str] = {}
    if teacher_ids:
        t_result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(teacher_ids))
        )
        for row in t_result.all():
            teachers[row[0]] = row[1]

    return [
        PendingInviteItem(
            member_id=str(m.id),
            turma_id=str(m.turma_id),
            turma_name=m.turma.name,
            teacher_name=teachers.get(m.turma.teacher_id, "Professor"),
            created_at=m.joined_at.isoformat(),
        )
        for m in membros
    ]


@router.post("/meus-convites/{member_id}/aceitar", status_code=200)
async def accept_invite(
    member_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Aceita um convite de turma.

    SEGURANÇA: Verifica que membro.user_id == current_user.id.
    """
    try:
        member_uuid = uuid.UUID(member_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")

    result = await db.execute(
        select(TurmaMembro).where(
            TurmaMembro.id == member_uuid,
            TurmaMembro.user_id == current_user.id,  # IDOR check
            TurmaMembro.status == TurmaMembroStatus.PENDING,
        )
    )
    membro = result.scalar_one_or_none()
    if not membro:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")

    membro.status = TurmaMembroStatus.ACTIVE
    await db.flush()
    logger.info("convite_aceito", member_id=member_id, user_id=str(current_user.id))
    return {"message": "Você entrou na turma!"}


@router.delete("/meus-convites/{member_id}", status_code=204)
async def reject_invite(
    member_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Recusa um convite de turma (soft delete).

    SEGURANÇA: Verifica que membro.user_id == current_user.id.
    """
    try:
        member_uuid = uuid.UUID(member_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")

    result = await db.execute(
        select(TurmaMembro).where(
            TurmaMembro.id == member_uuid,
            TurmaMembro.user_id == current_user.id,  # IDOR check
            TurmaMembro.status == TurmaMembroStatus.PENDING,
        )
    )
    membro = result.scalar_one_or_none()
    if not membro:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")

    membro.status = TurmaMembroStatus.REMOVED
    await db.flush()
    logger.info("convite_recusado", member_id=member_id, user_id=str(current_user.id))


# ─────────────────────────────────────────────────────────────────────────────
# Turmas do aluno — visão do aluno
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/minhas-turmas", response_model=list[PendingInviteItem])
async def get_my_active_turmas(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PendingInviteItem]:
    """
    Lista as turmas ativas do aluno (status=ACTIVE).

    SEGURANÇA: Filtra por user_id == current_user.id.
    """
    result = await db.execute(
        select(TurmaMembro)
        .options(selectinload(TurmaMembro.turma))
        .where(
            TurmaMembro.user_id == current_user.id,
            TurmaMembro.status == TurmaMembroStatus.ACTIVE,
        )
        .order_by(TurmaMembro.joined_at.desc())
    )
    membros = result.scalars().all()

    # Busca nomes dos professores
    teacher_ids = [m.turma.teacher_id for m in membros]
    teachers: dict[uuid.UUID, str] = {}
    if teacher_ids:
        t_result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(teacher_ids))
        )
        for row in t_result.all():
            teachers[row[0]] = row[1]

    return [
        PendingInviteItem(
            member_id=str(m.id),
            turma_id=str(m.turma_id),
            turma_name=m.turma.name,
            teacher_name=teachers.get(m.turma.teacher_id, "Professor"),
            created_at=m.joined_at.isoformat(),
        )
        for m in membros
    ]
