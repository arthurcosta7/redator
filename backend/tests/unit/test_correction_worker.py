"""Estados e recuperação do worker assíncrono de correções."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from arq import Retry

import app.workers.correction as worker
from app.core.config import settings
from app.db.models.essay import EssayStatus
from app.services.ai.correction_service import TransientAIError


class FakeSession:
    def __init__(self, scalars, gets=()):
        self.scalars = list(scalars)
        self.gets = list(gets)
        self.commits = 0
        self.rollbacks = 0

    async def scalar(self, _query):
        return self.scalars.pop(0)

    async def get(self, _model, _key):
        return self.gets.pop(0) if self.gets else None

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


class SessionContext:
    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, *_args):
        return False


def install_session(monkeypatch, session):
    monkeypatch.setattr(worker, "AsyncSessionLocal", lambda: SessionContext(session))


def essay(status=EssayStatus.PENDING):
    return SimpleNamespace(id=uuid4(), user_id=uuid4(), status=status, error_message="old error")


@pytest.mark.asyncio
async def test_missing_essay_finishes_without_retry(monkeypatch):
    session = FakeSession([None])
    install_session(monkeypatch, session)
    result = await worker.process_correction({}, str(uuid4()))
    assert result == {"status": "not_found"}
    assert session.commits == 0


@pytest.mark.asyncio
async def test_completed_job_is_idempotent(monkeypatch):
    item = essay(EssayStatus.PROCESSING)
    session = FakeSession([item, SimpleNamespace(id=uuid4())])
    install_session(monkeypatch, session)
    result = await worker.process_correction({}, str(item.id))
    assert result == {"status": "already_completed"}
    assert item.status == EssayStatus.COMPLETED
    assert session.commits == 1


@pytest.mark.asyncio
async def test_missing_owner_marks_essay_as_error(monkeypatch):
    item = essay()
    session = FakeSession([item, None], [None])
    install_session(monkeypatch, session)
    result = await worker.process_correction({}, str(item.id))
    assert result == {"status": "user_not_found"}
    assert item.status == EssayStatus.ERROR
    assert "Usuário" in item.error_message


@pytest.mark.asyncio
async def test_successful_job_transitions_and_commits(monkeypatch):
    item = essay()
    owner = SimpleNamespace(id=item.user_id, plan="standard")
    session = FakeSession([item, None], [owner])
    install_session(monkeypatch, session)
    calls = []

    async def correct(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(
        worker,
        "CorrectionService",
        lambda: SimpleNamespace(correct_essay=correct),
    )
    result = await worker.process_correction({}, str(item.id), is_assignment=True)
    assert result == {"status": "completed"}
    assert item.status == EssayStatus.PROCESSING
    assert item.error_message is None
    assert session.commits == 2
    assert calls[0]["is_assignment"] is True


@pytest.mark.asyncio
async def test_transient_provider_failure_requests_retry(monkeypatch):
    item = essay()
    owner = SimpleNamespace(id=item.user_id)
    session = FakeSession([item, None], [owner])
    install_session(monkeypatch, session)

    async def fail(**_kwargs):
        raise TransientAIError("provider")

    monkeypatch.setattr(
        worker,
        "CorrectionService",
        lambda: SimpleNamespace(correct_essay=fail),
    )
    with pytest.raises(Retry):
        await worker.process_correction({"job_try": 1}, str(item.id))
    assert session.rollbacks == 1


@pytest.mark.asyncio
async def test_terminal_failure_marks_error_and_releases_personal_quota(monkeypatch):
    item = essay()
    owner = SimpleNamespace(id=item.user_id)
    session = FakeSession([item, None], [owner, item])
    install_session(monkeypatch, session)

    async def fail(**_kwargs):
        raise RuntimeError("invalid response")

    released = []

    async def release(user_id, redis):
        released.append((user_id, redis))

    monkeypatch.setattr(
        worker,
        "CorrectionService",
        lambda: SimpleNamespace(correct_essay=fail),
    )
    monkeypatch.setattr(worker, "release_daily_correction_slot", release)
    redis = object()
    result = await worker.process_correction(
        {"job_try": settings.CORRECTION_JOB_MAX_TRIES, "redis": redis},
        str(item.id),
    )
    assert result == {"status": "error"}
    assert item.status == EssayStatus.ERROR
    assert released == [(str(item.user_id), redis)]


@pytest.mark.asyncio
async def test_permanent_failure_is_not_retried(monkeypatch):
    item = essay()
    owner = SimpleNamespace(id=item.user_id)
    session = FakeSession([item, None], [owner, item])
    install_session(monkeypatch, session)

    async def fail(**_kwargs):
        raise ValueError("invalid structured output")

    monkeypatch.setattr(
        worker,
        "CorrectionService",
        lambda: SimpleNamespace(correct_essay=fail),
    )

    async def release(*_args):
        return None

    monkeypatch.setattr(worker, "release_daily_correction_slot", release)

    result = await worker.process_correction(
        {"job_try": 1, "redis": object()},
        str(item.id),
    )

    assert result == {"status": "error"}
    assert item.status == EssayStatus.ERROR


@pytest.mark.asyncio
async def test_assignment_failure_does_not_release_daily_quota(monkeypatch):
    item = essay()
    owner = SimpleNamespace(id=item.user_id)
    session = FakeSession([item, None], [owner, item])
    install_session(monkeypatch, session)

    async def fail(**_kwargs):
        raise RuntimeError("invalid response")

    release = []
    monkeypatch.setattr(
        worker,
        "CorrectionService",
        lambda: SimpleNamespace(correct_essay=fail),
    )
    monkeypatch.setattr(worker, "release_daily_correction_slot", lambda *args: release.append(args))
    result = await worker.process_correction(
        {"job_try": settings.CORRECTION_JOB_MAX_TRIES, "redis": object()},
        str(item.id),
        is_assignment=True,
    )
    assert result == {"status": "error"}
    assert release == []
