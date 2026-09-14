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
  GET    /professor/redacoes/{id}                — correção completa autorizada
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
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, get_db, get_redis
from app.core.logging import get_logger
from app.core.rate_limiter import RateLimiter
from app.db.models.correction import Correction
from app.db.models.essay import Essay, EssayStatus
from app.db.models.tarefa import Tarefa, TarefaSubmissao
from app.db.models.turma import Turma, TurmaMembro, TurmaMembroStatus
from app.db.models.user import User, UserType
from app.schemas.essay import EssayDetailResponse
from app.schemas.tarefa import (
    GenerateThemeRequest,
    GenerateThemeResponse,
    MinhaSubmissaoView,
    MotivatingText,
    SubmissaoItem,
    TarefaCreate,
    TarefaListItem,
    TarefaResponse,
    TarefaStudentView,
    TarefaUpdate,
    TarefaWithSubmissoes,
    TeacherCommentRequest,
    TeacherSlotInfo,
)
from app.schemas.turma import (
    AddOfflineStudentRequest,
    InviteStudentRequest,
    PendingInviteItem,
    ProfessorOverviewAnalytics,
    StudentAnalyticsItem,
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
)
from app.services.ai.openai_client import create_openai_client
from app.services.correction_response import (
    build_basic_correction,
    build_full_correction,
)
from app.services.product_analytics import track_product_event
from app.services.teacher_plans import normalize_teacher_capacity

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


async def _check_teacher_slot_limit(
    teacher: User,
    db: AsyncSession,
    student_id: uuid.UUID | None = None,
) -> None:
    """
    Verifica se o professor ainda tem slots para adicionar alunos.

    O limite vale para a conta inteira. Um mesmo usuário em várias turmas ocupa
    uma vaga; cada aluno offline ocupa uma vaga própria.
    """
    # Serializa alterações concorrentes da lotação da mesma conta.
    await db.execute(select(User.id).where(User.id == teacher.id).with_for_update())
    registered, offline = await _active_teacher_seats(teacher.id, db)
    if student_id is not None and student_id in registered:
        return
    capacity = normalize_teacher_capacity(teacher.teacher_student_slots)
    if len(registered) + offline >= capacity:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Seu plano permite {capacity} alunos ativos no total. "
                "Remova um vínculo ativo ou escolha um plano com mais vagas."
            ),
        )


async def _active_teacher_seats(
    teacher_id: uuid.UUID, db: AsyncSession
) -> tuple[set[uuid.UUID], int]:
    """Retorna usuários únicos e quantidade de registros offline ativos."""
    result = await db.execute(
        select(TurmaMembro.user_id, TurmaMembro.id)
        .join(Turma, Turma.id == TurmaMembro.turma_id)
        .where(
            Turma.teacher_id == teacher_id,
            TurmaMembro.status == TurmaMembroStatus.ACTIVE,
        )
    )
    registered: set[uuid.UUID] = set()
    offline = 0
    for user_id, _member_id in result.all():
        if user_id is None:
            offline += 1
        else:
            registered.add(user_id)
    return registered, offline


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
    turma_id: uuid.UUID,
    db: AsyncSession,
) -> dict[uuid.UUID, dict]:
    """Retorna apenas estatísticas de submissões vinculadas à turma."""
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
        .where(
            Essay.user_id.in_(user_ids),
            Essay.id.in_(_turma_essay_ids(turma_id)),
        )
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


def _turma_essay_ids(turma_id: uuid.UUID):
    """IDs das redações efetivamente entregues em tarefas desta turma."""
    return (
        select(TarefaSubmissao.essay_id)
        .join(Tarefa, Tarefa.id == TarefaSubmissao.tarefa_id)
        .where(
            Tarefa.turma_id == turma_id,
            TarefaSubmissao.essay_id.is_not(None),
        )
    )


def _teacher_essay_ids(teacher_id: uuid.UUID):
    """IDs das entregas de alunos ativos em tarefas do professor."""
    return (
        select(TarefaSubmissao.essay_id)
        .join(Tarefa, Tarefa.id == TarefaSubmissao.tarefa_id)
        .join(Turma, Turma.id == Tarefa.turma_id)
        .join(
            TurmaMembro,
            and_(
                TurmaMembro.turma_id == Turma.id,
                TurmaMembro.user_id == TarefaSubmissao.student_id,
            ),
        )
        .where(
            Turma.teacher_id == teacher_id,
            TurmaMembro.status == TurmaMembroStatus.ACTIVE,
            TarefaSubmissao.essay_id.is_not(None),
        )
    )


@router.get("/redacoes/{essay_id}", response_model=EssayDetailResponse)
async def get_teacher_essay(
    essay_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EssayDetailResponse:
    """Retorna uma correção própria ou entregue em tarefa deste professor.

    A subconsulta vinculada a tarefa, turma e membro ativo evita IDOR: conhecer
    o UUID não permite visualizar redações avulsas nem entregas de outro professor.
    """
    try:
        essay_uuid = uuid.UUID(essay_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Redação não encontrada.")

    result = await db.execute(
        select(Essay)
        .options(selectinload(Essay.correction))
        .where(
            Essay.id == essay_uuid,
            or_(
                Essay.user_id == teacher.id,
                Essay.id.in_(_teacher_essay_ids(teacher.id)),
            ),
        )
    )
    essay = result.scalar_one_or_none()
    if not essay:
        # A resposta não distingue inexistência de falta de permissão.
        raise HTTPException(status_code=404, detail="Redação não encontrada.")

    correction_data = None
    if essay.correction:
        is_own_essay = essay.user_id == teacher.id
        if is_own_essay and teacher.plan.value == "free":
            correction_data = build_basic_correction(essay.correction)
        else:
            # O professor recebe a análise pedagógica completa das tarefas que criou.
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
                select(func.count(Essay.id))
                .where(
                    Essay.user_id.in_(active_user_ids),
                    Essay.id.in_(_turma_essay_ids(turma.id)),
                )
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
    track_product_event(
        logger, "class_created", user_id=str(teacher.id),
        account_type=teacher.user_type.value,
        teacher_plan=str(normalize_teacher_capacity(teacher.teacher_student_slots)),
    )
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
    stats = await _get_member_stats(active_user_ids, turma.id, db)

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
    await _check_teacher_slot_limit(teacher, db)

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
        teacher_id=str(teacher.id),
    )
    track_product_event(
        logger, "student_activated", user_id=str(teacher.id),
        account_type=teacher.user_type.value,
        teacher_plan=str(normalize_teacher_capacity(teacher.teacher_student_slots)),
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

    await _check_teacher_slot_limit(teacher, db, invited_user.id)

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
    track_product_event(
        logger, "invitation_sent", user_id=str(teacher.id),
        account_type=teacher.user_type.value,
        teacher_plan=str(normalize_teacher_capacity(teacher.teacher_student_slots)),
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
        .where(
            Essay.user_id.in_(active_user_ids),
            Essay.id.in_(_turma_essay_ids(turma.id)),
        )
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
    track_product_event(
        logger, "teacher_report_viewed", user_id=str(teacher.id),
        account_type=teacher.user_type.value, report_type="overview",
    )

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
                .where(
                    Essay.user_id.in_(active_uids),
                    Essay.id.in_(_turma_essay_ids(turma.id)),
                )
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
                    .where(
                        Essay.user_id.in_(active_uids),
                        Essay.id.in_(_turma_essay_ids(turma.id)),
                    )
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

        teacher_essay_scope = _teacher_essay_ids(teacher.id)

        total_row = await db.execute(
            select(func.count(Essay.id)).where(Essay.id.in_(teacher_essay_scope))
        )
        total_essays = total_row.scalar_one() or 0

        week_row = await db.execute(
            select(func.count(Essay.id))
            .where(
                Essay.id.in_(teacher_essay_scope),
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
            .where(Essay.id.in_(teacher_essay_scope))
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
    track_product_event(
        logger, "teacher_report_viewed", user_id=str(teacher.id),
        account_type=teacher.user_type.value, report_type="class",
    )
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    members_visible = [m for m in turma.members if m.status != TurmaMembroStatus.REMOVED]
    active_members = [m for m in members_visible if m.status == TurmaMembroStatus.ACTIVE]
    active_user_ids = [m.user_id for m in active_members if m.user_id is not None]

    stats = await _get_member_stats(active_user_ids, turma.id, db)

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
    track_product_event(
        logger, "teacher_report_viewed", user_id=str(teacher.id),
        account_type=teacher.user_type.value, report_type="student",
    )
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
            .where(
                Essay.user_id == membro.user_id,
                Essay.id.in_(_turma_essay_ids(membro.turma_id)),
            )
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

    teacher_result = await db.execute(
        select(User)
        .join(Turma, Turma.teacher_id == User.id)
        .where(Turma.id == membro.turma_id)
    )
    teacher = teacher_result.scalar_one()
    # A aceitação é o momento autoritativo: convites pendentes não ocupam vaga.
    await _check_teacher_slot_limit(teacher, db, current_user.id)
    membro.status = TurmaMembroStatus.ACTIVE
    await db.flush()
    logger.info("convite_aceito", member_id=member_id, user_id=str(current_user.id))
    track_product_event(
        logger, "student_activated", user_id=str(teacher.id),
        account_type=teacher.user_type.value,
        teacher_plan=str(normalize_teacher_capacity(teacher.teacher_student_slots)),
    )
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


# ─────────────────────────────────────────────────────────────────────────────
# Slots de alunos do professor
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/slots", response_model=TeacherSlotInfo)
async def get_teacher_slots(
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TeacherSlotInfo:
    """Retorna informações sobre os slots de alunos do professor."""
    registered, offline = await _active_teacher_seats(teacher.id, db)
    capacity = normalize_teacher_capacity(teacher.teacher_student_slots)
    return TeacherSlotInfo(
        slots_total=capacity,
        slots_used=len(registered) + offline,
        plan_name=f"Professor {capacity}" if teacher.teacher_student_slots else "Professor Free",
        is_paid=teacher.teacher_student_slots > 0,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tarefas — CRUD do professor
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/turmas/{turma_id}/tarefas", response_model=TarefaResponse, status_code=201)
async def create_tarefa(
    turma_id: str,
    data: TarefaCreate,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TarefaResponse:
    """Cria uma nova tarefa na turma."""
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    motivating_texts = (
        [t.model_dump() for t in data.motivating_texts]
        if data.motivating_texts else None
    )

    tarefa = Tarefa(
        turma_id=turma.id,
        title=data.title,
        instructions=data.instructions,
        essay_type=data.essay_type,
        theme=data.theme,
        motivating_texts=motivating_texts,
        due_date=data.due_date,
        is_ai_generated=False,
    )
    db.add(tarefa)
    await db.flush()

    result = await db.execute(select(Tarefa).where(Tarefa.id == tarefa.id))
    tarefa = result.scalar_one()

    logger.info("tarefa_criada", tarefa_id=str(tarefa.id), turma_id=turma_id)
    track_product_event(
        logger, "assignment_created", user_id=str(teacher.id),
        account_type=teacher.user_type.value,
        teacher_plan=str(normalize_teacher_capacity(teacher.teacher_student_slots)),
    )
    return _tarefa_to_response(tarefa)


@router.get("/turmas/{turma_id}/tarefas", response_model=list[TarefaListItem])
async def list_tarefas(
    turma_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TarefaListItem]:
    """Lista tarefas da turma com contagem de submissões."""
    turma = await _get_turma_or_404(turma_id, teacher.id, db)

    result = await db.execute(
        select(Tarefa)
        .where(Tarefa.turma_id == turma.id)
        .order_by(Tarefa.created_at.desc())
    )
    tarefas = result.scalars().all()

    counts = await _get_submission_counts([t.id for t in tarefas], db)

    return [
        TarefaListItem(
            id=str(t.id),
            title=t.title,
            essay_type=t.essay_type,
            theme=t.theme,
            due_date=t.due_date.isoformat() if t.due_date else None,
            is_ai_generated=t.is_ai_generated,
            is_closed=t.is_closed,
            created_at=t.created_at.isoformat(),
            submission_count=counts.get(t.id, 0),
        )
        for t in tarefas
    ]


@router.get("/tarefas/{tarefa_id}", response_model=TarefaWithSubmissoes)
async def get_tarefa(
    tarefa_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TarefaWithSubmissoes:
    """Detalhe da tarefa com lista de submissões dos alunos."""
    tarefa = await _get_tarefa_or_404(tarefa_id, teacher.id, db)

    submissoes_result = await db.execute(
        select(TarefaSubmissao)
        .options(
            selectinload(TarefaSubmissao.student),
            selectinload(TarefaSubmissao.essay).selectinload(Essay.correction),
        )
        .where(TarefaSubmissao.tarefa_id == tarefa.id)
        .order_by(TarefaSubmissao.submitted_at.desc())
    )
    submissoes = submissoes_result.scalars().all()

    items = [
        SubmissaoItem(
            id=str(s.id),
            student_id=str(s.student_id),
            student_name=s.student.full_name if s.student else "Aluno",
            essay_id=str(s.essay_id) if s.essay_id else None,
            submitted_at=s.submitted_at.isoformat() if s.submitted_at else None,
            total_score=s.essay.correction.total_score if s.essay and s.essay.correction else None,
            max_score=s.essay.correction.max_score if s.essay and s.essay.correction else None,
            teacher_comment=s.teacher_comment,
        )
        for s in submissoes
    ]

    resp = _tarefa_to_response(tarefa, submission_count=len(items))
    return TarefaWithSubmissoes(**resp.model_dump(), submissoes=items)


@router.patch("/tarefas/{tarefa_id}", response_model=TarefaResponse)
async def update_tarefa(
    tarefa_id: str,
    data: TarefaUpdate,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TarefaResponse:
    """Atualiza tarefa (título, instruções, tema, textos, prazo)."""
    tarefa = await _get_tarefa_or_404(tarefa_id, teacher.id, db)

    if data.title is not None:
        tarefa.title = data.title
    if data.instructions is not None:
        tarefa.instructions = data.instructions
    if data.theme is not None:
        tarefa.theme = data.theme
    if data.motivating_texts is not None:
        tarefa.motivating_texts = [t.model_dump() for t in data.motivating_texts]
    if data.due_date is not None:
        tarefa.due_date = data.due_date

    await db.flush()
    return _tarefa_to_response(tarefa)


@router.delete("/tarefas/{tarefa_id}", status_code=204)
async def delete_tarefa(
    tarefa_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove tarefa e todas as suas submissões (cascade)."""
    tarefa = await _get_tarefa_or_404(tarefa_id, teacher.id, db)
    await db.delete(tarefa)
    logger.info("tarefa_removida", tarefa_id=tarefa_id, teacher_id=str(teacher.id))


@router.post("/tarefas/{tarefa_id}/comentario/{submissao_id}", status_code=200)
async def add_teacher_comment(
    tarefa_id: str,
    submissao_id: str,
    data: TeacherCommentRequest,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Adiciona comentário do professor a uma submissão."""
    tarefa = await _get_tarefa_or_404(tarefa_id, teacher.id, db)

    try:
        sub_uuid = uuid.UUID(submissao_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Submissão não encontrada.")

    result = await db.execute(
        select(TarefaSubmissao).where(
            TarefaSubmissao.id == sub_uuid,
            TarefaSubmissao.tarefa_id == tarefa.id,
        )
    )
    submissao = result.scalar_one_or_none()
    if not submissao:
        raise HTTPException(status_code=404, detail="Submissão não encontrada.")

    submissao.teacher_comment = data.comment
    await db.flush()
    return {"message": "Comentário salvo."}


@router.post("/tarefas/gerar-tema", response_model=GenerateThemeResponse)
async def generate_theme(
    data: GenerateThemeRequest,
    teacher: Annotated[User, Depends(get_current_teacher)],
    redis_client=Depends(get_redis),
) -> GenerateThemeResponse:
    """
    Gera um tema e textos motivadores via IA (GPT-5.6 Luna).

    Uso: professor clica em 'Gerar com IA' ao criar uma tarefa.
    """
    import json
    import re

    from app.core.config import settings

    if normalize_teacher_capacity(teacher.teacher_student_slots) < 30:
        raise HTTPException(
            status_code=403,
            detail="A geração de tarefas com IA está disponível a partir do Professor 30.",
        )

    limiter = RateLimiter(redis_client)
    if not await limiter.check("theme_generation", str(teacher.id), 5, 300):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitos temas solicitados. Aguarde alguns minutos.",
        )

    client = create_openai_client()

    essay_label = "ENEM" if data.essay_type == "enem" else "Vestibular"
    prompt = (
        f"Gere um tema de redação no modelo {essay_label} para o Brasil, "
        "atual e relevante. Responda SOMENTE em JSON válido, sem markdown:\n"
        '{"theme": "o tema completo aqui", "motivating_texts": ['
        '{"title": "Título do texto 1", "content": "Trecho do texto motivador 1 (máx 150 palavras)"},'
        '{"title": "Título do texto 2", "content": "Trecho do texto motivador 2 (máx 150 palavras)"}'
        "]}"
    )

    response = await client.responses.create(
        model=settings.OPENAI_FREE_MODEL,
        max_output_tokens=800,
        reasoning={"effort": "none"},
        store=False,
        input=[{"role": "user", "content": prompt}],
        text={"format": {"type": "json_object"}},
    )

    if response.status == "incomplete":
        raise HTTPException(status_code=502, detail="Erro ao gerar tema. Tente novamente.")

    raw = response.output_text.strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not match:
            raise HTTPException(status_code=502, detail="Erro ao gerar tema. Tente novamente.")
        parsed = json.loads(match.group())

    logger.info("tema_gerado", teacher_id=str(teacher.id), essay_type=data.essay_type)
    track_product_event(
        logger, "assignment_ai_generated", user_id=str(teacher.id),
        account_type=teacher.user_type.value,
        teacher_plan=str(normalize_teacher_capacity(teacher.teacher_student_slots)),
    )
    return GenerateThemeResponse(
        theme=parsed["theme"],
        motivating_texts=[MotivatingText(**t) for t in parsed["motivating_texts"]],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tarefas — visão do aluno
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/minhas-turmas/{turma_id}/tarefas", response_model=list[TarefaStudentView])
async def list_my_tarefas(
    turma_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TarefaStudentView]:
    """
    Lista as tarefas de uma turma na perspectiva do aluno.

    SEGURANÇA: Verifica que o aluno é ACTIVE membro da turma.
    """
    from datetime import datetime, timezone

    try:
        turma_uuid = uuid.UUID(turma_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    member_check = await db.execute(
        select(TurmaMembro).where(
            TurmaMembro.turma_id == turma_uuid,
            TurmaMembro.user_id == current_user.id,
            TurmaMembro.status == TurmaMembroStatus.ACTIVE,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Você não é membro desta turma.")

    tarefas_result = await db.execute(
        select(Tarefa)
        .where(Tarefa.turma_id == turma_uuid)
        .order_by(Tarefa.created_at.desc())
    )
    tarefas = tarefas_result.scalars().all()

    tarefa_ids = [t.id for t in tarefas]
    minhas_submissoes: dict = {}
    if tarefa_ids:
        subs_result = await db.execute(
            select(TarefaSubmissao)
            .options(selectinload(TarefaSubmissao.essay).selectinload(Essay.correction))
            .where(
                TarefaSubmissao.tarefa_id.in_(tarefa_ids),
                TarefaSubmissao.student_id == current_user.id,
            )
        )
        for s in subs_result.scalars().all():
            minhas_submissoes[s.tarefa_id] = s

    now = datetime.now(timezone.utc)
    items = []
    for t in tarefas:
        sub = minhas_submissoes.get(t.id)
        my_sub = None
        if sub:
            my_sub = MinhaSubmissaoView(
                id=str(sub.id),
                essay_id=str(sub.essay_id) if sub.essay_id else None,
                submitted_at=sub.submitted_at.isoformat() if sub.submitted_at else None,
                total_score=sub.essay.correction.total_score if sub.essay and sub.essay.correction else None,
                max_score=sub.essay.correction.max_score if sub.essay and sub.essay.correction else None,
                teacher_comment=sub.teacher_comment,
            )
        items.append(TarefaStudentView(
            id=str(t.id),
            title=t.title,
            instructions=t.instructions,
            essay_type=t.essay_type,
            theme=t.theme,
            motivating_texts=t.motivating_texts,
            due_date=t.due_date.isoformat() if t.due_date else None,
            is_ai_generated=t.is_ai_generated,
            is_closed=t.is_closed,
            created_at=t.created_at.isoformat(),
            is_past_due=bool(t.due_date and t.due_date < now),
            my_submission=my_sub,
        ))

    return items


@router.get("/tarefas/{tarefa_id}/aluno", response_model=TarefaStudentView)
async def get_tarefa_aluno(
    tarefa_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TarefaStudentView:
    """
    Detalhe de uma tarefa na perspectiva do aluno.

    SEGURANÇA: Verifica que o aluno é ACTIVE membro da turma.
    """
    from datetime import datetime, timezone

    try:
        tarefa_uuid = uuid.UUID(tarefa_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    result = await db.execute(
        select(Tarefa).where(Tarefa.id == tarefa_uuid)
    )
    tarefa = result.scalar_one_or_none()
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    member_check = await db.execute(
        select(TurmaMembro).where(
            TurmaMembro.turma_id == tarefa.turma_id,
            TurmaMembro.user_id == current_user.id,
            TurmaMembro.status == TurmaMembroStatus.ACTIVE,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Você não tem acesso a esta tarefa.")

    sub_result = await db.execute(
        select(TarefaSubmissao)
        .options(selectinload(TarefaSubmissao.essay).selectinload(Essay.correction))
        .where(
            TarefaSubmissao.tarefa_id == tarefa_uuid,
            TarefaSubmissao.student_id == current_user.id,
        )
    )
    sub = sub_result.scalar_one_or_none()

    my_sub = None
    if sub:
        my_sub = MinhaSubmissaoView(
            id=str(sub.id),
            essay_id=str(sub.essay_id) if sub.essay_id else None,
            submitted_at=sub.submitted_at.isoformat() if sub.submitted_at else None,
            total_score=sub.essay.correction.total_score if sub.essay and sub.essay.correction else None,
            max_score=sub.essay.correction.max_score if sub.essay and sub.essay.correction else None,
            teacher_comment=sub.teacher_comment,
        )

    now = datetime.now(timezone.utc)
    return TarefaStudentView(
        id=str(tarefa.id),
        title=tarefa.title,
        instructions=tarefa.instructions,
        essay_type=tarefa.essay_type,
        theme=tarefa.theme,
        motivating_texts=tarefa.motivating_texts,
        due_date=tarefa.due_date.isoformat() if tarefa.due_date else None,
        is_ai_generated=tarefa.is_ai_generated,
        is_closed=tarefa.is_closed,
        created_at=tarefa.created_at.isoformat(),
        is_past_due=bool(tarefa.due_date and tarefa.due_date < now),
        my_submission=my_sub,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Fechar / Reabrir / Estender prazo
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/tarefas/{tarefa_id}/fechar", response_model=TarefaResponse)
async def fechar_tarefa(
    tarefa_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TarefaResponse:
    """Fecha a tarefa manualmente, bloqueando novas entregas."""
    tarefa = await _get_tarefa_or_404(tarefa_id, teacher.id, db)
    if tarefa.is_closed:
        raise HTTPException(status_code=409, detail="Tarefa já está fechada.")
    tarefa.is_closed = True
    await db.flush()
    logger.info("tarefa_fechada", tarefa_id=tarefa_id, teacher_id=str(teacher.id))
    return _tarefa_to_response(tarefa)


@router.post("/tarefas/{tarefa_id}/reabrir", response_model=TarefaResponse)
async def reabrir_tarefa(
    tarefa_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TarefaResponse:
    """Reabre a tarefa, permitindo novas entregas."""
    tarefa = await _get_tarefa_or_404(tarefa_id, teacher.id, db)
    if not tarefa.is_closed:
        raise HTTPException(status_code=409, detail="Tarefa já está aberta.")
    tarefa.is_closed = False
    await db.flush()
    logger.info("tarefa_reaberta", tarefa_id=tarefa_id, teacher_id=str(teacher.id))
    return _tarefa_to_response(tarefa)


# ─────────────────────────────────────────────────────────────────────────────
# Insights por tarefa (Professor 30 ou superior)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tarefas/{tarefa_id}/insights")
async def get_tarefa_insights(
    tarefa_id: str,
    teacher: Annotated[User, Depends(get_current_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Insights agregados de uma tarefa: distribuição de notas, média por
    competência e ranking dos alunos.

    SEGURANÇA:
    - Apenas professores no Professor 30 ou superior.
    - IDOR prevenido verificando que a tarefa pertence à turma do professor.
    """
    if normalize_teacher_capacity(teacher.teacher_student_slots) < 30:
        raise HTTPException(
            status_code=403,
            detail="Insights por tarefa estão disponíveis a partir do Professor 30.",
        )

    tarefa = await _get_tarefa_or_404(tarefa_id, teacher.id, db)

    # Busca todas as submissões com correção
    subs_result = await db.execute(
        select(TarefaSubmissao)
        .options(
            selectinload(TarefaSubmissao.student),
            selectinload(TarefaSubmissao.essay).selectinload(Essay.correction),
        )
        .where(
            TarefaSubmissao.tarefa_id == tarefa.id,
            TarefaSubmissao.submitted_at.isnot(None),
        )
        .order_by(TarefaSubmissao.submitted_at)
    )
    subs = subs_result.scalars().all()

    corrected = [
        s for s in subs
        if s.essay and s.essay.correction
    ]

    if not corrected:
        return {
            "tarefa_id": tarefa_id,
            "submission_count": len(subs),
            "corrected_count": 0,
            "avg_score_pct": None,
            "score_distribution": [],
            "competency_averages": [],
            "ranking": [],
        }

    max_score = corrected[0].essay.correction.max_score

    # Média geral
    pcts = [
        (s.essay.correction.total_score / max_score * 100)
        for s in corrected
    ]
    avg_pct = round(sum(pcts) / len(pcts), 1)

    # Distribuição em faixas (0-39, 40-59, 60-79, 80-100)
    bands = {"0-39": 0, "40-59": 0, "60-79": 0, "80-100": 0}
    for p in pcts:
        if p < 40:
            bands["0-39"] += 1
        elif p < 60:
            bands["40-59"] += 1
        elif p < 80:
            bands["60-79"] += 1
        else:
            bands["80-100"] += 1
    distribution = [{"range": k, "count": v} for k, v in bands.items()]

    # Médias por competência
    competency_totals: dict[str, list[float]] = {}
    for s in corrected:
        for comp in (s.essay.correction.competencies or []):
            name = comp.get("name") or comp.get("title", "")
            score = comp.get("score", 0)
            max_c = comp.get("max_score", comp.get("max", 0)) or 1
            pct_c = score / max_c * 100
            competency_totals.setdefault(name, []).append(pct_c)

    competency_averages = [
        {"name": name, "avg_pct": round(sum(vals) / len(vals), 1)}
        for name, vals in competency_totals.items()
    ]

    # Ranking dos alunos
    ranking = sorted(
        [
            {
                "student_name": s.student.full_name if s.student else "Aluno",
                "total_score": s.essay.correction.total_score,
                "max_score": max_score,
                "score_pct": round(s.essay.correction.total_score / max_score * 100, 1),
            }
            for s in corrected
        ],
        key=lambda x: -x["score_pct"],
    )

    return {
        "tarefa_id": tarefa_id,
        "tarefa_title": tarefa.title,
        "submission_count": len(subs),
        "corrected_count": len(corrected),
        "avg_score_pct": avg_pct,
        "max_score": max_score,
        "score_distribution": distribution,
        "competency_averages": competency_averages,
        "ranking": ranking,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Helpers internos de tarefas
# ─────────────────────────────────────────────────────────────────────────────

async def _get_tarefa_or_404(
    tarefa_id: str,
    teacher_id: uuid.UUID,
    db: AsyncSession,
) -> Tarefa:
    """
    Busca tarefa verificando que pertence ao professor via turma.

    SEGURANÇA: Previne IDOR verificando teacher_id pela turma.
    """
    try:
        tarefa_uuid = uuid.UUID(tarefa_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    result = await db.execute(
        select(Tarefa)
        .join(Turma, Turma.id == Tarefa.turma_id)
        .where(Tarefa.id == tarefa_uuid, Turma.teacher_id == teacher_id)
    )
    tarefa = result.scalar_one_or_none()
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
    return tarefa


def _tarefa_to_response(tarefa: Tarefa, submission_count: int = 0) -> TarefaResponse:
    return TarefaResponse(
        id=str(tarefa.id),
        turma_id=str(tarefa.turma_id),
        title=tarefa.title,
        instructions=tarefa.instructions,
        essay_type=tarefa.essay_type,
        theme=tarefa.theme,
        motivating_texts=tarefa.motivating_texts,
        due_date=tarefa.due_date.isoformat() if tarefa.due_date else None,
        is_ai_generated=tarefa.is_ai_generated,
        is_closed=tarefa.is_closed,
        created_at=tarefa.created_at.isoformat(),
        submission_count=submission_count,
    )


async def _get_submission_counts(
    tarefa_ids: list,
    db: AsyncSession,
) -> dict:
    if not tarefa_ids:
        return {}
    rows = await db.execute(
        select(TarefaSubmissao.tarefa_id, func.count(TarefaSubmissao.id))
        .where(TarefaSubmissao.tarefa_id.in_(tarefa_ids))
        .group_by(TarefaSubmissao.tarefa_id)
    )
    return {row[0]: row[1] for row in rows.all()}
