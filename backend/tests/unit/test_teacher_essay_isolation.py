"""Regressões de autorização para redações exibidas a professores."""

import uuid

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.professor import (
    _check_teacher_slot_limit,
    get_overview_analytics,
    get_student_analytics,
    get_teacher_essay,
    get_teacher_slots,
    get_turma,
    get_turma_analytics,
    get_turma_essays,
    list_turmas,
)
from app.db.models.correction import Correction
from app.db.models.essay import Essay, EssayInputType, EssayStatus, EssayType
from app.db.models.tarefa import Tarefa, TarefaSubmissao
from app.db.models.turma import Turma, TurmaMembro, TurmaMembroStatus
from app.db.models.user import User, UserPlan, UserType


async def _user(db_session, user_type: UserType) -> User:
    user = User(
        full_name="Pessoa Teste",
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="hash-for-tests",
        user_type=user_type,
        plan=UserPlan.FREE,
        is_active=True,
        is_email_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _essay(db_session, student: User, title: str) -> Essay:
    essay = Essay(
        user_id=student.id,
        title=title,
        content="Texto de redação com conteúdo suficiente para o teste de isolamento.",
        theme="Tema de teste",
        essay_type=EssayType.ENEM,
        input_type=EssayInputType.TEXT,
        status=EssayStatus.PENDING,
        word_count=120,
    )
    db_session.add(essay)
    await db_session.flush()
    return essay


async def _assignment_submission(
    db_session,
    turma: Turma,
    student: User,
    essay: Essay,
) -> None:
    tarefa = Tarefa(
        turma_id=turma.id,
        title="Tarefa de redação",
        essay_type="enem",
        theme="Tema de teste",
    )
    db_session.add(tarefa)
    await db_session.flush()
    db_session.add(
        TarefaSubmissao(
            tarefa_id=tarefa.id,
            student_id=student.id,
            essay_id=essay.id,
        )
    )
    await db_session.flush()


async def _correction(db_session, essay: Essay, student: User) -> Correction:
    correction = Correction(
        essay_id=essay.id,
        user_id=student.id,
        total_score=800,
        max_score=1000,
        competencies=[
            {
                "number": number,
                "name": f"Competência {number}",
                "score": 160,
                "max_score": 200,
                "feedback": "Análise pedagógica detalhada.",
                "strengths": ["Acerto identificado no texto."],
                "improvements": ["Melhoria específica para a próxima versão."],
            }
            for number in range(1, 6)
        ],
        highlights=[
            {
                "start": 0,
                "end": 5,
                "text": "Texto",
                "type": "positive",
                "comment": "Tese bem delimitada.",
            }
        ],
        insights={
            "general_feedback": "Análise completa para aluno e professor.",
            "main_strengths": ["Tese clara."],
            "priority_improvements": ["Aprofundar a justificativa."],
            "writing_level": "intermediário",
        },
    )
    db_session.add(correction)
    await db_session.flush()
    return correction


@pytest.mark.asyncio
async def test_teacher_only_sees_essays_submitted_to_own_assignments(db_session):
    teacher = await _user(db_session, UserType.TEACHER)
    other_teacher = await _user(db_session, UserType.TEACHER)
    student = await _user(db_session, UserType.STUDENT)

    own_class = Turma(teacher_id=teacher.id, name="Turma do professor")
    other_class = Turma(teacher_id=other_teacher.id, name="Outra turma")
    db_session.add_all([own_class, other_class])
    await db_session.flush()

    own_member = TurmaMembro(
        turma_id=own_class.id,
        user_id=student.id,
        status=TurmaMembroStatus.ACTIVE,
    )
    other_member = TurmaMembro(
        turma_id=other_class.id,
        user_id=student.id,
        status=TurmaMembroStatus.ACTIVE,
    )
    db_session.add_all([own_member, other_member])
    await db_session.flush()

    standalone = await _essay(db_session, student, "Redação avulsa")
    own_submission = await _essay(db_session, student, "Tarefa deste professor")
    other_submission = await _essay(db_session, student, "Tarefa de outro professor")
    await _assignment_submission(db_session, own_class, student, own_submission)
    await _assignment_submission(db_session, other_class, student, other_submission)
    await _correction(db_session, own_submission, student)

    essays = await get_turma_essays(
        str(own_class.id), teacher, db_session, page=1, per_page=20
    )
    assert [item.id for item in essays.items] == [str(own_submission.id)]
    assert str(standalone.id) not in {item.id for item in essays.items}
    assert str(other_submission.id) not in {item.id for item in essays.items}

    class_detail = await get_turma(str(own_class.id), teacher, db_session)
    assert class_detail.essay_count == 1

    class_analytics = await get_turma_analytics(
        str(own_class.id), teacher, db_session
    )
    assert class_analytics.total_essays == 1
    assert class_analytics.students[0].essay_count == 1

    classes = await list_turmas(teacher, db_session)
    assert len(classes) == 1
    assert classes[0].essay_count == 1

    student_analytics = await get_student_analytics(
        str(own_member.id), teacher, db_session
    )
    assert student_analytics.essay_count == 1
    assert [item.id for item in student_analytics.essays] == [str(own_submission.id)]

    overview = await get_overview_analytics(teacher, db_session)
    assert overview.total_essay_count == 1
    assert overview.essays_this_week == 1
    assert overview.turmas[0].essay_count == 1

    # A rota de detalhe libera todos os dados pedagógicos apenas para uma
    # entrega vinculada à tarefa do professor autenticado.
    detail = await get_teacher_essay(str(own_submission.id), teacher, db_session)
    assert detail.content == own_submission.content
    assert detail.correction is not None
    assert hasattr(detail.correction, "insights")
    assert detail.correction.competencies[0].strengths == [
        "Acerto identificado no texto."
    ]

    for forbidden_essay in (standalone, other_submission):
        with pytest.raises(HTTPException) as denied:
            await get_teacher_essay(str(forbidden_essay.id), teacher, db_session)
        assert denied.value.status_code == 404

    own_member.status = TurmaMembroStatus.REMOVED
    await db_session.flush()
    with pytest.raises(HTTPException) as removed_member_denied:
        await get_teacher_essay(str(own_submission.id), teacher, db_session)
    assert removed_member_denied.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await get_turma_essays(
            str(own_class.id), other_teacher, db_session, page=1, per_page=20
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_teacher_capacity_counts_unique_users_across_all_classes(db_session):
    teacher = await _user(db_session, UserType.TEACHER)
    student = await _user(db_session, UserType.STUDENT)
    first = Turma(teacher_id=teacher.id, name="Primeira")
    second = Turma(teacher_id=teacher.id, name="Segunda")
    db_session.add_all([first, second])
    await db_session.flush()
    first_link = TurmaMembro(
        turma_id=first.id, user_id=student.id, status=TurmaMembroStatus.ACTIVE
    )
    second_link = TurmaMembro(
        turma_id=second.id, user_id=student.id, status=TurmaMembroStatus.ACTIVE
    )
    db_session.add_all([
        first_link,
        second_link,
        TurmaMembro(turma_id=first.id, display_name="Aluno offline 1", status=TurmaMembroStatus.ACTIVE),
        TurmaMembro(turma_id=second.id, display_name="Aluno offline 2", status=TurmaMembroStatus.ACTIVE),
    ])
    await db_session.flush()

    slots = await get_teacher_slots(teacher, db_session)
    assert slots.slots_total == 3
    assert slots.slots_used == 3

    # O mesmo usuário já ativo em outra turma não ocupa uma vaga adicional.
    await _check_teacher_slot_limit(teacher, db_session, student.id)
    with pytest.raises(HTTPException, match="3 alunos ativos"):
        await _check_teacher_slot_limit(teacher, db_session)

    # Remover somente um vínculo não libera a vaga se o aluno continuar ativo
    # em outra turma; a vaga é liberada quando o último vínculo fica inativo.
    first_link.status = TurmaMembroStatus.REMOVED
    await db_session.flush()
    assert (await get_teacher_slots(teacher, db_session)).slots_used == 3
    second_link.status = TurmaMembroStatus.REMOVED
    await db_session.flush()
    assert (await get_teacher_slots(teacher, db_session)).slots_used == 2


@pytest.mark.asyncio
async def test_removing_active_member_releases_teacher_seat(db_session):
    teacher = await _user(db_session, UserType.TEACHER)
    turma = Turma(teacher_id=teacher.id, name="Turma")
    db_session.add(turma)
    await db_session.flush()
    members = [
        TurmaMembro(turma_id=turma.id, display_name=f"Offline {index}", status=TurmaMembroStatus.ACTIVE)
        for index in range(3)
    ]
    db_session.add_all(members)
    await db_session.flush()
    with pytest.raises(HTTPException):
        await _check_teacher_slot_limit(teacher, db_session)

    members[0].status = TurmaMembroStatus.REMOVED
    await db_session.flush()
    await _check_teacher_slot_limit(teacher, db_session)
    assert (await get_teacher_slots(teacher, db_session)).slots_used == 2
