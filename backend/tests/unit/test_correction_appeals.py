"""Garantias de seguranca e consistencia do fluxo de contestacao."""
import uuid

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.appeals import (
    REVIEWER_ROLES,
    claim_appeal,
    create_appeal,
    get_reviewer_appeal,
    improvement_dataset,
    resolve_appeal,
    review_queue,
)
from app.api.v1.endpoints.admin import ALL_ADMIN_ROLES
from app.core.dependencies import require_admin_role
from app.db.models.correction import Correction
from app.db.models.correction_appeal import AppealStatus, CorrectionAppeal
from app.db.models.essay import Essay, EssayInputType, EssayStatus, EssayType
from app.db.models.user import AdminRole, User, UserPlan, UserType
from app.schemas.appeal import CreateAppealRequest, ResolveAppealRequest


async def _user(db_session, *, user_type=UserType.STUDENT, role=None) -> User:
    user = User(
        full_name="Pessoa Teste",
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="hash-for-tests",
        user_type=user_type,
        plan=UserPlan.STANDARD,
        is_active=True,
        is_email_verified=True,
        admin_role=role,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _correction(db_session, owner: User) -> Correction:
    essay = Essay(
        user_id=owner.id,
        title="Redacao em teste",
        content="Texto de redacao suficientemente longo para uma revisao humana.",
        theme="Tema em teste",
        essay_type=EssayType.ENEM,
        input_type=EssayInputType.TEXT,
        status=EssayStatus.COMPLETED,
        word_count=120,
    )
    db_session.add(essay)
    await db_session.flush()
    correction = Correction(
        essay_id=essay.id,
        user_id=owner.id,
        total_score=800,
        max_score=1000,
        competencies=[
            {
                "number": number,
                "name": f"Competencia {number}",
                "score": 160,
                "max_score": 200,
                "feedback": "Avaliacao original",
            }
            for number in range(1, 6)
        ],
        highlights=[],
        insights={"general_feedback": "Bom texto"},
        ai_model_used="gpt-test",
    )
    db_session.add(correction)
    await db_session.flush()
    return correction


@pytest.mark.asyncio
async def test_student_can_only_appeal_own_correction(db_session):
    owner = await _user(db_session)
    attacker = await _user(db_session)
    correction = await _correction(db_session, owner)

    with pytest.raises(HTTPException) as exc:
        await create_appeal(
            CreateAppealRequest(
                correction_id=str(correction.id),
                reason="Esta justificativa tem mais de trinta caracteres validos.",
            ),
            attacker,
            db_session,
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_approved_appeal_updates_score_and_preserves_original(db_session):
    student = await _user(db_session)
    reviewer = await _user(
        db_session,
        user_type=UserType.TEACHER,
        role=AdminRole.LICENSED_TEACHER,
    )
    correction = await _correction(db_session, student)
    created = await create_appeal(
        CreateAppealRequest(
            correction_id=str(correction.id),
            reason="A competencia tres nao considerou meu argumento principal.",
            allow_anonymized_improvement=True,
        ),
        student,
        db_session,
    )
    await claim_appeal(created.id, reviewer, db_session)

    resolved = await resolve_appeal(
        created.id,
        ResolveAppealRequest(
            decision="corrected",
            explanation=(
                "A analise humana confirmou que o argumento central atende ao criterio "
                "e justifica o ajuste registrado nas cinco competencias."
            ),
            corrected_total_score=840,
            competency_scores=[
                {"number": 1, "score": 160},
                {"number": 2, "score": 160},
                {"number": 3, "score": 200},
                {"number": 4, "score": 160},
                {"number": 5, "score": 160},
            ],
        ),
        reviewer,
        db_session,
    )

    appeal = await db_session.get(CorrectionAppeal, uuid.UUID(created.id))
    assert resolved.status == "corrected"
    assert correction.total_score == 840
    assert appeal is not None
    assert appeal.original_total_score == 800
    assert appeal.status == AppealStatus.CORRECTED
    assert appeal.training_eligible is True


@pytest.mark.asyncio
async def test_upheld_appeal_does_not_change_score_or_enter_dataset(db_session):
    student = await _user(db_session)
    reviewer = await _user(
        db_session,
        user_type=UserType.TEACHER,
        role=AdminRole.LICENSED_TEACHER,
    )
    correction = await _correction(db_session, student)
    created = await create_appeal(
        CreateAppealRequest(
            correction_id=str(correction.id),
            reason="Discordo da nota e solicito uma conferencia humana detalhada.",
            allow_anonymized_improvement=True,
        ),
        student,
        db_session,
    )
    await claim_appeal(created.id, reviewer, db_session)
    await resolve_appeal(
        created.id,
        ResolveAppealRequest(
            decision="upheld",
            explanation=(
                "A nota foi mantida porque os argumentos apresentados nao cumprem o "
                "criterio indicado, conforme os trechos analisados no parecer."
            ),
        ),
        reviewer,
        db_session,
    )

    appeal = await db_session.get(CorrectionAppeal, uuid.UUID(created.id))
    assert correction.total_score == 800
    assert appeal is not None
    assert appeal.status == AppealStatus.UPHELD
    assert appeal.training_eligible is False


@pytest.mark.asyncio
async def test_competency_sum_must_match_new_total(db_session):
    student = await _user(db_session)
    reviewer = await _user(
        db_session,
        user_type=UserType.TEACHER,
        role=AdminRole.LICENSED_TEACHER,
    )
    correction = await _correction(db_session, student)
    created = await create_appeal(
        CreateAppealRequest(
            correction_id=str(correction.id),
            reason="A soma apresentada parece inconsistente com as competencias.",
        ),
        student,
        db_session,
    )
    await claim_appeal(created.id, reviewer, db_session)

    with pytest.raises(HTTPException) as exc:
        await resolve_appeal(
            created.id,
            ResolveAppealRequest(
                decision="corrected",
                explanation=(
                    "A revisao detectou divergencia, mas este payload simula uma soma "
                    "invalida para garantir que o servidor bloqueie a decisao."
                ),
                corrected_total_score=900,
                competency_scores=[
                    {"number": number, "score": 160} for number in range(1, 6)
                ],
            ),
            reviewer,
            db_session,
        )

    assert exc.value.status_code == 422
    assert correction.total_score == 800


@pytest.mark.asyncio
async def test_second_reviewer_cannot_claim_or_resolve_reserved_appeal(db_session):
    student = await _user(db_session)
    first = await _user(
        db_session, user_type=UserType.TEACHER, role=AdminRole.LICENSED_TEACHER
    )
    second = await _user(
        db_session, user_type=UserType.TEACHER, role=AdminRole.LICENSED_TEACHER
    )
    correction = await _correction(db_session, student)
    created = await create_appeal(
        CreateAppealRequest(
            correction_id=str(correction.id),
            reason="Solicito uma segunda analise dos criterios desta correcao.",
        ),
        student,
        db_session,
    )
    await claim_appeal(created.id, first, db_session)

    with pytest.raises(HTTPException) as claim_error:
        await claim_appeal(created.id, second, db_session)
    assert claim_error.value.status_code == 409

    with pytest.raises(HTTPException) as resolve_error:
        await resolve_appeal(
            created.id,
            ResolveAppealRequest(
                decision="upheld",
                explanation=(
                    "Este parecer nao pode ser registrado porque o caso pertence "
                    "a outro professor licenciado que iniciou a analise."
                ),
            ),
            second,
            db_session,
        )
    assert resolve_error.value.status_code == 409


@pytest.mark.asyncio
async def test_reviewer_cannot_list_or_read_another_reviewers_closed_cases(db_session):
    student = await _user(db_session)
    owner_reviewer = await _user(
        db_session, user_type=UserType.TEACHER, role=AdminRole.LICENSED_TEACHER
    )
    other_reviewer = await _user(
        db_session, user_type=UserType.TEACHER, role=AdminRole.LICENSED_TEACHER
    )
    correction = await _correction(db_session, student)
    created = await create_appeal(
        CreateAppealRequest(
            correction_id=str(correction.id),
            reason="Quero que um professor confira os criterios aplicados pela IA.",
        ),
        student,
        db_session,
    )
    await claim_appeal(created.id, owner_reviewer, db_session)
    await resolve_appeal(
        created.id,
        ResolveAppealRequest(
            decision="upheld",
            explanation=(
                "A avaliacao foi conferida integralmente e a nota original esta "
                "coerente com os criterios e com os trechos apresentados."
            ),
        ),
        owner_reviewer,
        db_session,
    )

    queue = await review_queue(other_reviewer, db_session, queue_status="upheld")
    assert queue.total == 0

    with pytest.raises(HTTPException) as read_error:
        await get_reviewer_appeal(created.id, other_reviewer, db_session)
    assert read_error.value.status_code == 404


@pytest.mark.asyncio
async def test_licensed_teacher_and_admin_permissions_are_isolated(db_session):
    reviewer = await _user(
        db_session, user_type=UserType.TEACHER, role=AdminRole.LICENSED_TEACHER
    )
    admin = await _user(db_session, user_type=UserType.TEACHER, role=AdminRole.ADMIN)

    with pytest.raises(HTTPException) as admin_area_error:
        await require_admin_role(*ALL_ADMIN_ROLES)(reviewer.id, db_session)
    assert admin_area_error.value.status_code == 403

    with pytest.raises(HTTPException) as review_area_error:
        await require_admin_role(*REVIEWER_ROLES)(admin.id, db_session)
    assert review_area_error.value.status_code == 403


@pytest.mark.asyncio
async def test_improvement_dataset_removes_account_and_contact_identifiers(db_session):
    student = await _user(db_session)
    reviewer = await _user(
        db_session, user_type=UserType.TEACHER, role=AdminRole.LICENSED_TEACHER
    )
    correction = await _correction(db_session, student)
    essay = await db_session.get(Essay, correction.essay_id)
    assert essay is not None
    essay.content = (
        "Meu contato pessoal e aluno@example.com e meu telefone e (11) 99999-8888."
    )
    created = await create_appeal(
        CreateAppealRequest(
            correction_id=str(correction.id),
            reason="A competencia tres nao considerou meu argumento principal.",
            allow_anonymized_improvement=True,
        ),
        student,
        db_session,
    )
    await claim_appeal(created.id, reviewer, db_session)
    await resolve_appeal(
        created.id,
        ResolveAppealRequest(
            decision="corrected",
            explanation=(
                "A analise humana identificou uma divergencia objetiva e corrigiu "
                "a terceira competencia com base no argumento apresentado."
            ),
            corrected_total_score=840,
            competency_scores=[
                {"number": 1, "score": 160},
                {"number": 2, "score": 160},
                {"number": 3, "score": 200},
                {"number": 4, "score": 160},
                {"number": 5, "score": 160},
            ],
        ),
        reviewer,
        db_session,
    )

    dataset = await improvement_dataset(reviewer, db_session, limit=100)
    payload = dataset[0].model_dump()
    serialized = str(payload).lower()
    assert "appeal_id" not in payload
    assert "student_id" not in serialized
    assert "reviewer_id" not in serialized
    assert "aluno@example.com" not in serialized
    assert "99999-8888" not in serialized
