"""Regressões para falhas encontradas durante a auditoria de segurança."""
from datetime import datetime, timezone
from uuid import uuid4

import pytest
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from starlette.requests import Request

from app.api.v1.endpoints.auth import create_user, register_student
from app.api.v1.endpoints.essays import get_essay
from app.api.v1.endpoints.users import _serialize_user
from app.core.config import Settings, settings
from app.core.dependencies import get_current_admin
from app.core.logging import remove_sensitive_data
from app.core.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.core.rate_limiter import RateLimiter
from app.core.security import hash_password
from app.db.models.essay import Essay, EssayInputType, EssayStatus, EssayType
from app.db.models.user import User, UserPlan, UserType
from app.schemas.auth import RegisterStudentRequest


class _FailingPipeline:
    async def zremrangebyscore(self, *args):
        return None

    async def zcard(self, *args):
        return None

    async def zadd(self, *args):
        return None

    async def expire(self, *args):
        return None

    async def execute(self):
        raise redis.ConnectionError("redis unavailable")


class _FailingRedis:
    def pipeline(self):
        return _FailingPipeline()


def _user(email: str, *, user_id=None) -> User:
    return User(
        id=user_id or uuid4(),
        full_name="Usuário de Teste",
        email=email,
        hashed_password=hash_password("SenhaSegura123"),
        user_type=UserType.STUDENT,
        plan=UserPlan.FREE,
        is_active=True,
        is_email_verified=True,
        teacher_student_slots=0,
    )


@pytest.mark.asyncio
async def test_login_rate_limit_fails_closed_when_redis_is_down():
    limiter = RateLimiter(_FailingRedis())

    assert await limiter.check("login_15min", "127.0.0.1", 5, 900) is False
    assert await limiter.check("login_1hour", "127.0.0.1", 20, 3600) is False


@pytest.mark.asyncio
async def test_non_sensitive_rate_limit_can_fail_open_when_redis_is_down():
    limiter = RateLimiter(_FailingRedis())

    assert await limiter.check("public_api", "127.0.0.1", 5, 60) is True


@pytest.mark.asyncio
async def test_registration_fails_closed_when_rate_limiter_is_unavailable(db_session):
    request = Request({"type": "http", "client": ("127.0.0.1", 12345)})
    data = RegisterStudentRequest(
        full_name="João Silva",
        email="joao@example.com",
        password="SenhaSegura123",
    )

    with pytest.raises(HTTPException) as exc:
        await register_student(data, request, db_session, _FailingRedis())

    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_duplicate_registration_does_not_reveal_existing_email(db_session):
    existing = _user("existing@example.com")
    db_session.add(existing)
    await db_session.flush()

    result = await create_user(
        db_session,
        full_name="Outra Pessoa",
        email="existing@example.com",
        password="OutraSenha123",
        user_type=UserType.STUDENT,
    )

    assert result is None


@pytest.mark.asyncio
async def test_essay_idor_returns_same_404_for_another_users_record(db_session):
    owner = _user("owner@example.com")
    attacker = _user("attacker@example.com")
    essay = Essay(
        user_id=owner.id,
        title="Redação privada",
        content="Conteúdo que pertence somente ao autor.",
        essay_type=EssayType.ENEM,
        input_type=EssayInputType.TEXT,
        status=EssayStatus.PENDING,
    )
    db_session.add_all([owner, attacker, essay])
    await db_session.flush()

    with pytest.raises(HTTPException) as exc:
        await get_essay(str(essay.id), attacker, db_session)

    assert exc.value.status_code == 404
    assert exc.value.detail == "Redação não encontrada."


@pytest.mark.asyncio
async def test_regular_user_cannot_access_admin_dependency(db_session):
    regular_user = _user("regular@example.com")
    db_session.add(regular_user)
    await db_session.flush()

    with pytest.raises(HTTPException) as exc:
        await get_current_admin(regular_user.id, db_session)

    assert exc.value.status_code == 403


def test_profile_response_never_contains_password_or_tokens():
    user = _user("profile@example.com")
    user.created_at = datetime.now(timezone.utc)
    response = _serialize_user(user).model_dump()

    assert "hashed_password" not in response
    assert not any("token" in key for key in response)
    assert "password" not in str(response).lower()


def test_nested_sensitive_log_fields_are_redacted():
    event = {
        "event": "security-test",
        "Authorization": "Bearer secret-token",
        "payload": {
            "new_password": "Segredo123",
            "metadata": [{"refresh_token": "secret"}],
        },
    }

    cleaned = remove_sensitive_data(None, "info", event)

    assert cleaned["Authorization"] == "***REDACTED***"
    assert cleaned["payload"]["new_password"] == "***REDACTED***"
    assert cleaned["payload"]["metadata"][0]["refresh_token"] == "***REDACTED***"


def test_production_rejects_any_insecure_cors_origin():
    with pytest.raises(ValidationError, match="ALLOWED_ORIGINS"):
        Settings(
            SECRET_KEY="0123456789abcdef" * 4,
            DATABASE_URL="postgresql+asyncpg://user:pass@db/redator",
            REDIS_URL="redis://:strong-password@redis:6379/0",
            ENVIRONMENT="production",
            DEBUG=False,
            FRONTEND_URL="https://redator.example",
            ALLOWED_ORIGINS=[
                "https://redator.example",
                "http://localhost:3000",
            ],
        )


@pytest.mark.asyncio
async def test_request_id_is_sanitized_and_api_is_not_cacheable(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    test_app = FastAPI()
    test_app.add_middleware(SecurityHeadersMiddleware)
    test_app.add_middleware(RequestIDMiddleware)

    @test_app.get("/api/private")
    async def private_route():
        return {"ok": True}

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://testserver",
    ) as client:
        response = await client.get(
            "/api/private",
            headers={"X-Request-ID": "bad-id\r\nInjected: true"},
        )

    request_id = response.headers["X-Request-ID"]
    assert response.status_code == 200
    assert "\r" not in request_id and "\n" not in request_id
    assert request_id != "bad-id\r\nInjected: true"
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Strict-Transport-Security"].startswith("max-age=31536000")
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]
    assert "X-Process-Time" not in response.headers
