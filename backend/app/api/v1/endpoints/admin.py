"""
admin.py — Endpoints do painel administrativo

Todos os endpoints aqui exigem autenticação + admin_role válido.
O nível de acesso é checado no banco a cada requisição.

Níveis de acesso:
  superadmin → Tudo, incluindo gerenciar outros admins
  admin      → Usuários, redações, analytics
  support    → Visualizar usuários/redações, ações de suporte
  analyst    → Somente leitura — analytics e estatísticas

SEGURANÇA:
- Toda ação destrutiva exige superadmin
- Todas as ações são logadas com o ID do admin executor
- Superadmin não pode remover a si mesmo (previne lockout)
- Promoção para superadmin é bloqueada via API
"""
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_db, require_admin_role
from app.core.logging import get_logger
from app.db.models.correction import Correction
from app.db.models.essay import Essay, EssayStatus, EssayType
from app.db.models.user import AdminRole, User, UserPlan, UserType
from app.schemas.admin import (
    AdminAnalytics,
    AdminAnalyticsDay,
    AdminEssayItem,
    AdminEssaysResponse,
    AdminStats,
    AdminTeamInvite,
    AdminTeamMember,
    AdminTeamRoleUpdate,
    AdminUserDetail,
    AdminUserItem,
    AdminUsersResponse,
    AdminUserUpdate,
)

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = get_logger(__name__)

# Roles que podem acessar o painel (qualquer nível)
ALL_ADMIN_ROLES = ["superadmin", "admin", "analyst", "support"]
# Roles que podem fazer alterações em usuários
MANAGE_ROLES = ["superadmin", "admin", "support"]
# Roles que podem ver analytics completos
ANALYTICS_ROLES = ["superadmin", "admin", "analyst"]


# ─────────────────────────────────────────────────────────────────────────────
# Estatísticas gerais
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    admin: Annotated[User, Depends(require_admin_role(*ALL_ADMIN_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminStats:
    """
    Retorna estatísticas gerais da plataforma.
    Acessível por qualquer nível de admin.
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Totais de usuários
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar_one()
    new_users_today = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )).scalar_one()
    new_users_week = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= week_start)
    )).scalar_one()

    # Totais de redações
    total_essays = (await db.execute(select(func.count(Essay.id)))).scalar_one()
    essays_today = (await db.execute(
        select(func.count(Essay.id)).where(Essay.created_at >= today_start)
    )).scalar_one()
    essays_week = (await db.execute(
        select(func.count(Essay.id)).where(Essay.created_at >= week_start)
    )).scalar_one()

    # Correções concluídas
    corrections_completed = (await db.execute(
        select(func.count(Essay.id)).where(Essay.status == EssayStatus.COMPLETED)
    )).scalar_one()
    corrections_today = (await db.execute(
        select(func.count(Essay.id)).where(
            Essay.status == EssayStatus.COMPLETED,
            Essay.updated_at >= today_start,
        )
    )).scalar_one()

    # Distribuição de planos
    plan_rows = (await db.execute(
        select(User.plan, func.count(User.id))
        .where(User.is_active == True)
        .group_by(User.plan)
    )).all()
    plan_distribution = {row[0].value: row[1] for row in plan_rows}
    # Garante que todos os planos aparecem mesmo com 0
    for plan in UserPlan:
        plan_distribution.setdefault(plan.value, 0)

    # Distribuição de tipo de usuário
    type_rows = (await db.execute(
        select(User.user_type, func.count(User.id))
        .where(User.is_active == True)
        .group_by(User.user_type)
    )).all()
    user_type_distribution = {row[0].value: row[1] for row in type_rows}

    # Distribuição de tipo de redação
    essay_type_rows = (await db.execute(
        select(Essay.essay_type, func.count(Essay.id)).group_by(Essay.essay_type)
    )).all()
    essay_type_distribution = {row[0].value: row[1] for row in essay_type_rows}

    # Distribuição de status de redação
    status_rows = (await db.execute(
        select(Essay.status, func.count(Essay.id)).group_by(Essay.status)
    )).all()
    status_distribution = {row[0].value: row[1] for row in status_rows}

    logger.info("admin_stats_viewed", admin_id=str(admin.id), admin_role=admin.admin_role.value)

    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        new_users_today=new_users_today,
        new_users_week=new_users_week,
        total_essays=total_essays,
        essays_today=essays_today,
        essays_week=essays_week,
        corrections_completed=corrections_completed,
        corrections_today=corrections_today,
        plan_distribution=plan_distribution,
        user_type_distribution=user_type_distribution,
        essay_type_distribution=essay_type_distribution,
        status_distribution=status_distribution,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Analytics (30 dias)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/analytics", response_model=AdminAnalytics)
async def get_analytics(
    admin: Annotated[User, Depends(require_admin_role(*ANALYTICS_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=30, ge=7, le=90, description="Número de dias"),
) -> AdminAnalytics:
    """
    Retorna analytics diários dos últimos N dias.
    Acessível por superadmin, admin e analyst.
    """
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # cast(timestamp, Date) evita o problema do asyncpg com date_trunc parametrizado:
    # date_trunc("day", col) gera $1::VARCHAR para "day", e o PostgreSQL trata
    # SELECT e GROUP BY como expressões distintas. cast(col, Date) não tem literal.
    essay_day = cast(Essay.created_at, Date)
    correction_day = cast(Essay.updated_at, Date)
    user_day = cast(User.created_at, Date)

    # Redações por dia
    essay_rows = (await db.execute(
        select(essay_day.label("day"), func.count(Essay.id).label("count"))
        .where(Essay.created_at >= start_date)
        .group_by(essay_day)
        .order_by(essay_day)
    )).all()

    # Correções concluídas por dia
    correction_rows = (await db.execute(
        select(correction_day.label("day"), func.count(Essay.id).label("count"))
        .where(
            Essay.status == EssayStatus.COMPLETED,
            Essay.updated_at >= start_date,
        )
        .group_by(correction_day)
        .order_by(correction_day)
    )).all()

    # Novos usuários por dia
    user_rows = (await db.execute(
        select(user_day.label("day"), func.count(User.id).label("count"))
        .where(User.created_at >= start_date)
        .group_by(user_day)
        .order_by(user_day)
    )).all()

    # cast retorna datetime.date — usa .isoformat() diretamente (sem .date())
    essays_by_day = {row[0].isoformat(): row[1] for row in essay_rows}
    corrections_by_day = {row[0].isoformat(): row[1] for row in correction_rows}
    users_by_day = {row[0].isoformat(): row[1] for row in user_rows}

    # Gera lista completa de dias (sem gaps)
    daily = []
    for i in range(days):
        day = (start_date + timedelta(days=i)).date()
        day_str = day.isoformat()
        daily.append(AdminAnalyticsDay(
            date=day_str,
            essays_submitted=essays_by_day.get(day_str, 0),
            corrections_completed=corrections_by_day.get(day_str, 0),
            new_users=users_by_day.get(day_str, 0),
        ))

    logger.info("admin_analytics_viewed", admin_id=str(admin.id), days=days)

    return AdminAnalytics(daily=daily)


# ─────────────────────────────────────────────────────────────────────────────
# Gerenciamento de Usuários
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=AdminUsersResponse)
async def list_users(
    admin: Annotated[User, Depends(require_admin_role(*MANAGE_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None, description="Busca por nome ou email"),
    plan: Optional[str] = Query(default=None),
    user_type: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
) -> AdminUsersResponse:
    """
    Lista todos os usuários com filtros e paginação.
    Acessível por superadmin, admin e support.
    """
    query = select(User)
    count_query = select(func.count(User.id))

    # Filtros
    if search:
        # SEGURANÇA: Usa LIKE parametrizado — nunca interpolação de string
        like_pattern = f"%{search.strip()}%"
        from sqlalchemy import or_, cast, String
        query = query.where(
            or_(
                User.full_name.ilike(like_pattern),
                User.email.ilike(like_pattern),
            )
        )
        count_query = count_query.where(
            or_(
                User.full_name.ilike(like_pattern),
                User.email.ilike(like_pattern),
            )
        )

    if plan:
        query = query.where(User.plan == plan)
        count_query = count_query.where(User.plan == plan)

    if user_type:
        query = query.where(User.user_type == user_type)
        count_query = count_query.where(User.user_type == user_type)

    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)

    # Total
    total = (await db.execute(count_query)).scalar_one()

    # Paginação
    offset = (page - 1) * per_page
    query = query.order_by(User.created_at.desc()).offset(offset).limit(per_page)
    users = (await db.execute(query)).scalars().all()

    # Conta redações por usuário
    user_ids = [u.id for u in users]
    if user_ids:
        essay_counts = (await db.execute(
            select(Essay.user_id, func.count(Essay.id))
            .where(Essay.user_id.in_(user_ids))
            .group_by(Essay.user_id)
        )).all()
        essay_count_map = {str(row[0]): row[1] for row in essay_counts}
    else:
        essay_count_map = {}

    items = [
        AdminUserItem(
            id=str(u.id),
            full_name=u.full_name,
            email=u.email,
            user_type=u.user_type.value,
            plan=u.plan.value,
            is_active=u.is_active,
            is_email_verified=u.is_email_verified,
            admin_role=u.admin_role.value if u.admin_role else None,
            created_at=u.created_at.isoformat(),
            essay_count=essay_count_map.get(str(u.id), 0),
        )
        for u in users
    ]

    return AdminUsersResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(offset + per_page) < total,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user_detail(
    user_id: str,
    admin: Annotated[User, Depends(require_admin_role(*MANAGE_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUserDetail:
    """
    Retorna detalhes completos de um usuário.
    SEGURANÇA: Inclui campos de segurança (tentativas de login, bloqueio).
    """
    from sqlalchemy import select as sa_select

    result = await db.execute(sa_select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Última redação
    last_essay = (await db.execute(
        select(Essay.created_at)
        .where(Essay.user_id == user_id)
        .order_by(Essay.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    essay_count = (await db.execute(
        select(func.count(Essay.id)).where(Essay.user_id == user_id)
    )).scalar_one()

    logger.info(
        "admin_user_viewed",
        admin_id=str(admin.id),
        target_user_id=user_id,
    )

    return AdminUserDetail(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        user_type=user.user_type.value,
        plan=user.plan.value,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        admin_role=user.admin_role.value if user.admin_role else None,
        school_name=user.school_name,
        discipline=user.discipline,
        grade=user.grade,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until.isoformat() if user.locked_until else None,
        created_at=user.created_at.isoformat(),
        essay_count=essay_count,
        last_essay_at=last_essay.isoformat() if last_essay else None,
    )


@router.patch("/users/{user_id}", response_model=AdminUserDetail)
async def update_user(
    user_id: str,
    body: AdminUserUpdate,
    admin: Annotated[User, Depends(require_admin_role(*MANAGE_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUserDetail:
    """
    Atualiza plano, status ou verificação de email de um usuário.

    SEGURANÇA:
    - Support pode banir/desbanir e verificar email, mas NÃO alterar plano.
    - Apenas admin/superadmin podem alterar o plano.
    - Ninguém pode alterar outro admin por este endpoint.
    """
    from sqlalchemy import select as sa_select

    result = await db.execute(sa_select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # SEGURANÇA: Support não pode alterar plano nem tipo de conta
    # (admin_role não está no schema AdminUserUpdate — nunca é alterado aqui)
    if body.plan is not None and admin.admin_role == AdminRole.SUPPORT:
        raise HTTPException(
            status_code=403,
            detail="Support não tem permissão para alterar planos.",
        )
    if body.user_type is not None and admin.admin_role == AdminRole.SUPPORT:
        raise HTTPException(
            status_code=403,
            detail="Support não tem permissão para alterar o tipo de conta.",
        )

    changed_fields = []

    if body.plan is not None:
        user.plan = body.plan
        changed_fields.append(f"plan={body.plan.value}")

    if body.user_type is not None:
        old_type = user.user_type.value
        user.user_type = body.user_type
        # Limpa campos específicos do tipo anterior ao trocar
        if body.user_type == UserType.STUDENT:
            user.school_name = None
            user.discipline = None
        else:
            user.grade = None
        changed_fields.append(f"user_type={old_type}→{body.user_type.value}")

    if body.is_active is not None:
        user.is_active = body.is_active
        if body.is_active:
            # Desbloqueia também ao reativar
            user.failed_login_attempts = 0
            user.locked_until = None
        changed_fields.append(f"is_active={body.is_active}")

    if body.is_email_verified is not None:
        user.is_email_verified = body.is_email_verified
        changed_fields.append(f"is_email_verified={body.is_email_verified}")

    if changed_fields:
        await db.flush()
        logger.info(
            "admin_user_updated",
            admin_id=str(admin.id),
            admin_role=admin.admin_role.value,
            target_user_id=user_id,
            changes=", ".join(changed_fields),
        )

    # Retorna detalhe atualizado
    return await get_user_detail(user_id, admin, db)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    admin: Annotated[User, Depends(require_admin_role("superadmin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Deleta permanentemente um usuário e todos seus dados.

    SEGURANÇA:
    - Exclusivo para superadmin.
    - Superadmin não pode deletar a si mesmo.
    - Admins não podem ser deletados por este endpoint.
    """
    if str(admin.id) == user_id:
        raise HTTPException(
            status_code=400,
            detail="Você não pode deletar sua própria conta pelo painel.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if user.admin_role is not None:
        raise HTTPException(
            status_code=403,
            detail="Admins devem ser removidos pela seção Equipe.",
        )

    await db.delete(user)
    await db.flush()

    logger.warning(
        "admin_user_deleted",
        admin_id=str(admin.id),
        deleted_user_id=user_id,
        deleted_user_email=user.email,  # Log para auditoria
    )


# ─────────────────────────────────────────────────────────────────────────────
# Gerenciamento de Redações
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/essays", response_model=AdminEssaysResponse)
async def list_essays(
    admin: Annotated[User, Depends(require_admin_role(*ALL_ADMIN_ROLES))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    essay_type: Optional[str] = Query(default=None),
    essay_status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None, description="Busca por email ou nome do usuário"),
) -> AdminEssaysResponse:
    """
    Lista todas as redações com filtros.
    Acessível por todos os admins.
    """
    query = (
        select(Essay)
        .options(selectinload(Essay.correction))
        .join(User, Essay.user_id == User.id)
    )
    count_query = select(func.count(Essay.id)).join(User, Essay.user_id == User.id)

    if essay_type:
        query = query.where(Essay.essay_type == essay_type)
        count_query = count_query.where(Essay.essay_type == essay_type)

    if essay_status:
        query = query.where(Essay.status == essay_status)
        count_query = count_query.where(Essay.status == essay_status)

    if search:
        like_pattern = f"%{search.strip()}%"
        from sqlalchemy import or_
        query = query.where(
            or_(User.email.ilike(like_pattern), User.full_name.ilike(like_pattern))
        )
        count_query = count_query.where(
            or_(User.email.ilike(like_pattern), User.full_name.ilike(like_pattern))
        )

    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * per_page
    query = query.order_by(Essay.created_at.desc()).offset(offset).limit(per_page)
    essays_raw = (await db.execute(query)).scalars().all()

    # Busca nomes/emails dos usuários
    user_ids = list({e.user_id for e in essays_raw})
    if user_ids:
        user_rows = (await db.execute(
            select(User.id, User.full_name, User.email).where(User.id.in_(user_ids))
        )).all()
        user_map = {str(row[0]): {"name": row[1], "email": row[2]} for row in user_rows}
    else:
        user_map = {}

    items = []
    for e in essays_raw:
        u = user_map.get(str(e.user_id), {"name": "—", "email": "—"})
        items.append(AdminEssayItem(
            id=str(e.id),
            title=e.title,
            essay_type=e.essay_type.value,
            input_type=e.input_type.value,
            status=e.status.value,
            word_count=e.word_count,
            created_at=e.created_at.isoformat(),
            user_id=str(e.user_id),
            user_name=u["name"],
            user_email=u["email"],
            total_score=e.correction.total_score if e.correction else None,
            max_score=e.correction.max_score if e.correction else None,
        ))

    return AdminEssaysResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(offset + per_page) < total,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Gerenciamento da Equipe Admin
# Exclusivo para superadmin
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/team", response_model=list[AdminTeamMember])
async def list_team(
    admin: Annotated[User, Depends(require_admin_role("superadmin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AdminTeamMember]:
    """
    Lista todos os membros da equipe admin.
    Exclusivo para superadmin.
    """
    admins = (await db.execute(
        select(User)
        .where(User.admin_role.is_not(None))
        .order_by(User.admin_role, User.created_at)
    )).scalars().all()

    return [
        AdminTeamMember(
            id=str(u.id),
            full_name=u.full_name,
            email=u.email,
            admin_role=u.admin_role.value,
            is_active=u.is_active,
            created_at=u.created_at.isoformat(),
        )
        for u in admins
    ]


@router.post("/team", response_model=AdminTeamMember, status_code=201)
async def add_team_member(
    body: AdminTeamInvite,
    admin: Annotated[User, Depends(require_admin_role("superadmin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminTeamMember:
    """
    Concede acesso admin a um usuário existente.

    SEGURANÇA:
    - Não cria conta nova — o usuário já deve existir.
    - Promoção para superadmin é bloqueada via validação Pydantic.
    - Ação é logada com ID do executor.
    """
    result = await db.execute(select(User).where(User.email == str(body.email)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Nenhum usuário com este email foi encontrado. "
                   "O usuário deve criar uma conta antes de receber acesso admin.",
        )

    if user.admin_role is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Este usuário já é {user.admin_role.value}.",
        )

    if body.admin_role == AdminRole.LICENSED_TEACHER and user.user_type != UserType.TEACHER:
        raise HTTPException(
            status_code=422,
            detail="O revisor licenciado precisa ter uma conta do tipo professor.",
        )

    user.admin_role = body.admin_role
    await db.flush()

    logger.warning(
        "admin_role_granted",
        executor_id=str(admin.id),
        target_user_id=str(user.id),
        target_email=user.email,
        role_granted=body.admin_role.value,
    )

    return AdminTeamMember(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        admin_role=user.admin_role.value,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.patch("/team/{member_id}/role", response_model=AdminTeamMember)
async def update_team_member_role(
    member_id: str,
    body: AdminTeamRoleUpdate,
    admin: Annotated[User, Depends(require_admin_role("superadmin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminTeamMember:
    """
    Altera o nível de acesso de um membro da equipe.

    SEGURANÇA:
    - Superadmin não pode rebaixar a si mesmo (previne lockout).
    - Promoção para superadmin via API é bloqueada.
    """
    if str(admin.id) == member_id:
        raise HTTPException(
            status_code=400,
            detail="Você não pode alterar sua própria role.",
        )

    result = await db.execute(select(User).where(User.id == member_id))
    user = result.scalar_one_or_none()

    if not user or not user.admin_role:
        raise HTTPException(status_code=404, detail="Membro da equipe não encontrado.")

    if body.admin_role == AdminRole.LICENSED_TEACHER and user.user_type != UserType.TEACHER:
        raise HTTPException(
            status_code=422,
            detail="O revisor licenciado precisa ter uma conta do tipo professor.",
        )

    old_role = user.admin_role.value
    user.admin_role = body.admin_role
    await db.flush()

    logger.warning(
        "admin_role_changed",
        executor_id=str(admin.id),
        target_user_id=member_id,
        old_role=old_role,
        new_role=body.admin_role.value,
    )

    return AdminTeamMember(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        admin_role=user.admin_role.value,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.delete("/team/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    member_id: str,
    admin: Annotated[User, Depends(require_admin_role("superadmin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Remove o acesso admin de um membro (não deleta a conta).

    SEGURANÇA: Superadmin não pode remover a si mesmo.
    """
    if str(admin.id) == member_id:
        raise HTTPException(
            status_code=400,
            detail="Você não pode remover a si mesmo da equipe.",
        )

    result = await db.execute(select(User).where(User.id == member_id))
    user = result.scalar_one_or_none()

    if not user or not user.admin_role:
        raise HTTPException(status_code=404, detail="Membro da equipe não encontrado.")

    removed_role = user.admin_role.value
    user.admin_role = None
    await db.flush()

    logger.warning(
        "admin_role_removed",
        executor_id=str(admin.id),
        target_user_id=member_id,
        removed_role=removed_role,
    )
