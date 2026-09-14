"""Regressões de concorrência e esgotamento de recursos."""
import asyncio
from typing import Any
from uuid import UUID, uuid4

import pytest

from app.api.v1.endpoints.essays import submit_essay
from app.core.rate_limiter import (
    RateLimiter,
    _credit_policy,
    check_monthly_credits,
    reserve_monthly_credit,
)
from app.core.security import hash_password
from app.db.models.essay import Essay, EssayStatus, EssayType
from app.db.models.user import User, UserPlan, UserType
from app.schemas.essay import SubmitEssayRequest
from app.services.ai.simulado_service import SimuladoService


class AtomicRedis:
    """Simula a atomicidade de EVAL para exercitar chamadas concorrentes."""

    def __init__(self) -> None:
        self.lock = asyncio.Lock()
        self.credit_state: dict[str, dict[str, int | str]] = {}
        self.window_count = 0

    async def eval(
        self,
        script: str,
        number_of_keys: int,
        key: str,
        *args: str,
    ) -> list[int]:
        async with self.lock:
            if "HSET" in script:
                period, plan, base, rollover_cap, _ttl, reserve, previous_period = args
                state = self.credit_state.get(key)
                if state is None or state["period"] != period or state["plan"] != plan:
                    carry = 0
                    if (
                        state is not None
                        and state["plan"] == plan
                        and state["period"] == previous_period
                    ):
                        carry = min(
                            max(int(state["limit"]) - int(state["used"]), 0),
                            int(rollover_cap),
                        )
                    state = {
                        "period": period,
                        "plan": plan,
                        "used": 0,
                        "limit": int(base) + carry,
                        "rollover": carry,
                    }
                    self.credit_state[key] = state
                if reserve == "1":
                    if int(state["used"]) >= int(state["limit"]):
                        return [0, int(state["used"]), int(state["limit"]), int(state["rollover"])]
                    state["used"] = int(state["used"]) + 1
                return [1, int(state["used"]), int(state["limit"]), int(state["rollover"])]

            maximum = int(args[3])
            if self.window_count >= maximum:
                return [0, self.window_count]
            self.window_count += 1
            return [1, self.window_count]


class PoolRedis:
    def __init__(self) -> None:
        self.lock = asyncio.Lock()
        self.items: list[str] = []
        self.locks: dict[str, str] = {}

    async def rpop(self, key: str) -> str | None:
        async with self.lock:
            return self.items.pop() if self.items else None

    async def llen(self, key: str) -> int:
        return len(self.items)

    async def lpush(self, key: str, value: str) -> None:
        async with self.lock:
            self.items.insert(0, value)

    async def expire(self, key: str, ttl: int) -> None:
        return None

    async def set(self, key: str, value: str, **kwargs: Any) -> bool:
        async with self.lock:
            if kwargs.get("nx") and key in self.locks:
                return False
            self.locks[key] = value
            return True

    async def eval(self, script: str, number_of_keys: int, key: str, token: str) -> int:
        async with self.lock:
            if self.locks.get(key) == token:
                del self.locks[key]
                return 1
            return 0


class CountingSimuladoService(SimuladoService):
    def __init__(self) -> None:
        self.calls = 0

    async def _generate_batch(self, essay_type: str) -> list[dict[str, Any]]:
        self.calls += 1
        await asyncio.sleep(0.05)
        return [{"id": str(index), "essay_type": essay_type} for index in range(5)]


@pytest.mark.asyncio
async def test_monthly_quota_cannot_be_oversubscribed_concurrently(monkeypatch: Any) -> None:
    redis_client = AtomicRedis()
    monkeypatch.setattr("app.core.rate_limiter.settings.PLAN_FREE_MONTHLY_CORRECTIONS", 3)

    results = await asyncio.gather(
        *(
            reserve_monthly_credit("same-user", "free", redis_client)
            for _ in range(100)
        )
    )

    assert sum(allowed for allowed, _, _, _ in results) == 3
    assert redis_client.credit_state["monthly_credits:corrections:same-user"]["used"] == 3


@pytest.mark.asyncio
async def test_paid_monthly_credits_roll_over_only_up_to_cap(monkeypatch: Any) -> None:
    redis_client = AtomicRedis()
    monkeypatch.setattr("app.core.rate_limiter.settings.PLAN_STANDARD_MONTHLY_CORRECTIONS", 12)
    monkeypatch.setattr("app.core.rate_limiter._month_period", lambda _now=None: "2026-08")
    monkeypatch.setattr("app.core.rate_limiter._previous_month_period", lambda _now=None: "2026-07")
    await asyncio.gather(
        *(reserve_monthly_credit("paid", "standard", redis_client) for _ in range(2))
    )

    monkeypatch.setattr("app.core.rate_limiter._month_period", lambda _now=None: "2026-09")
    monkeypatch.setattr("app.core.rate_limiter._previous_month_period", lambda _now=None: "2026-08")
    allowed, used, limit, rollover = await check_monthly_credits("paid", "standard", redis_client)

    assert allowed is True
    assert used == 0
    assert limit == 16
    assert rollover == 4


@pytest.mark.asyncio
async def test_paid_credits_do_not_roll_over_after_an_inactive_month(monkeypatch: Any) -> None:
    redis_client = AtomicRedis()
    monkeypatch.setattr("app.core.rate_limiter.settings.PLAN_STANDARD_MONTHLY_CORRECTIONS", 12)
    monkeypatch.setattr("app.core.rate_limiter._month_period", lambda _now=None: "2026-07")
    monkeypatch.setattr("app.core.rate_limiter._previous_month_period", lambda _now=None: "2026-06")
    await reserve_monthly_credit("inactive", "standard", redis_client)

    monkeypatch.setattr("app.core.rate_limiter._month_period", lambda _now=None: "2026-09")
    monkeypatch.setattr("app.core.rate_limiter._previous_month_period", lambda _now=None: "2026-08")
    allowed, used, limit, rollover = await check_monthly_credits(
        "inactive", "standard", redis_client
    )

    assert allowed is True
    assert used == 0
    assert limit == 12
    assert rollover == 0


def test_monthly_credit_policies_match_commercial_plans() -> None:
    assert _credit_policy("free", "corrections") == (4, 0)
    assert _credit_policy("standard", "corrections") == (12, 4)
    assert _credit_policy("pro", "corrections") == (30, 10)
    assert _credit_policy("free", "simulations") == (1, 0)
    assert _credit_policy("standard", "simulations") == (3, 0)
    assert _credit_policy("pro", "simulations") == (8, 0)


@pytest.mark.asyncio
async def test_rate_limit_is_not_oversubscribed_concurrently() -> None:
    redis_client = AtomicRedis()
    limiter = RateLimiter(redis_client)

    results = await asyncio.gather(
        *(limiter.check("essay_submission", "same-user", 10, 300) for _ in range(100))
    )

    assert sum(results) == 10
    assert redis_client.window_count == 10


@pytest.mark.asyncio
async def test_empty_simulado_pool_generates_only_one_batch_under_concurrency() -> None:
    redis_client = PoolRedis()
    service = CountingSimuladoService()

    results = await asyncio.gather(
        *(service.get_simulado("enem", redis_client) for _ in range(5))
    )

    assert service.calls == 1
    assert {item["id"] for item in results} == {str(index) for index in range(5)}


@pytest.mark.asyncio
async def test_submission_returns_pending_and_enqueues_without_calling_ai(
    db_session: Any,
    monkeypatch: Any,
) -> None:
    user = User(
        id=uuid4(),
        full_name="Carga Local",
        email="carga-local@example.com",
        hashed_password=hash_password("SenhaSegura123"),
        user_type=UserType.STUDENT,
        plan=UserPlan.FREE,
        is_active=True,
        is_email_verified=True,
        teacher_student_slots=0,
    )
    db_session.add(user)
    await db_session.flush()
    enqueued: list[tuple[str, bool]] = []

    async def fake_enqueue(essay_id: str, is_assignment: bool = False) -> None:
        enqueued.append((essay_id, is_assignment))

    monkeypatch.setattr("app.api.v1.endpoints.essays.enqueue_correction", fake_enqueue)
    request = SubmitEssayRequest(
        title="Teste de fila",
        content=" ".join(["argumentação"] * 120),
        theme="Educação e cidadania no Brasil contemporâneo",
        essay_type=EssayType.ENEM,
    )

    response = await submit_essay(request, user, db_session, AtomicRedis())

    persisted = await db_session.get(Essay, UUID(response.id))
    assert response.status == EssayStatus.PENDING.value
    assert persisted is not None and persisted.status == EssayStatus.PENDING
    assert enqueued == [(response.id, False)]
