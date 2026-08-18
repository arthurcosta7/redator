"""Fila de correções: configuração, unicidade e encerramento."""
from types import SimpleNamespace

import pytest

import app.core.job_queue as job_queue


def test_arq_settings_inherit_connection_limits():
    redis_settings = job_queue.get_arq_redis_settings()
    assert redis_settings.conn_timeout > 0
    assert redis_settings.max_connections > 0


@pytest.mark.asyncio
async def test_enqueue_uses_deterministic_job_id(monkeypatch):
    captured: dict = {}

    class Queue:
        async def enqueue_job(self, *args, **kwargs):
            captured["args"] = args
            captured["kwargs"] = kwargs
            return SimpleNamespace(job_id=kwargs["_job_id"])

    async def fake_queue():
        return Queue()

    monkeypatch.setattr(job_queue, "get_job_queue", fake_queue)
    await job_queue.enqueue_correction("essay-123", True)

    assert captured["args"] == ("process_correction", "essay-123", True)
    assert captured["kwargs"]["_job_id"] == "correction:essay-123"
    assert captured["kwargs"]["_queue_name"] == "arq:queue:corrections"


@pytest.mark.asyncio
async def test_duplicate_queue_job_is_rejected(monkeypatch):
    class Queue:
        async def enqueue_job(self, *_args, **_kwargs):
            return None

    async def fake_queue():
        return Queue()

    monkeypatch.setattr(job_queue, "get_job_queue", fake_queue)
    with pytest.raises(RuntimeError, match="já está enfileirada"):
        await job_queue.enqueue_correction("essay-duplicate")


@pytest.mark.asyncio
async def test_close_queue_is_idempotent(monkeypatch):
    closed = 0

    class Queue:
        async def aclose(self):
            nonlocal closed
            closed += 1

    monkeypatch.setattr(job_queue, "_job_queue", Queue())
    await job_queue.close_job_queue()
    await job_queue.close_job_queue()
    assert closed == 1
    assert job_queue._job_queue is None
