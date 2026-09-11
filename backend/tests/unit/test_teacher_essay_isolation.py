"""Regressões de autorização para redações exibidas a professores."""

import uuid

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.professor import (
    get_overview_analytics,
    get_student_analytics,
    get_turma,
    get_turma_analytics,
    get_turma_essays,
    list_turmas,
)
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

    with pytest.raises(HTTPException) as exc:
        await get_turma_essays(
            str(own_class.id), other_teacher, db_session, page=1, per_page=20
        )
    assert exc.value.status_code == 404
