"""Teste opcional contra Redis real para validar os scripts Lua em concorrência."""
import asyncio
import os
from uuid import uuid4

import pytest
import redis.asyncio as redis

from app.core.rate_limiter import RateLimiter, reserve_monthly_credit


@pytest.mark.asyncio
async def test_real_redis_atomic_limits(monkeypatch):
    redis_url = os.getenv("SCALABILITY_REDIS_URL")
    if not redis_url:
        pytest.skip("Defina SCALABILITY_REDIS_URL para executar o teste Redis real")

    client = redis.from_url(redis_url, decode_responses=True)
    user_id = f"scale-{uuid4()}"
    monkeypatch.setattr("app.core.rate_limiter.settings.PLAN_FREE_MONTHLY_CORRECTIONS", 7)
    try:
        quota_results = await asyncio.gather(
            *(reserve_monthly_credit(user_id, "free", client) for _ in range(200))
        )
        rate_results = await asyncio.gather(
            *(RateLimiter(client).check("scale_test", user_id, 25, 60) for _ in range(200))
        )

        assert sum(allowed for allowed, _, _, _ in quota_results) == 7
        assert sum(rate_results) == 25
    finally:
        keys = await client.keys(f"*{user_id}*")
        if keys:
            await client.delete(*keys)
        await client.aclose()
