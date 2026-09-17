"""Regressões para falhas encontradas durante a auditoria de segurança."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Response
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from starlette.requests import Request

from app.api.v1.endpoints.auth import (
    create_user,
    login,
    register_student,
    set_auth_cookies,
    verify_email,
)
from app.api.v1.endpoints.essays import get_essay
from app.api.v1.endpoints.stripe import stripe_webhook
from app.api.v1.endpoints.users import _serialize_user
from app.core.config import Settings, settings
from app.core.dependencies import get_current_admin, get_current_user_id
from app.core.logging import remove_sensitive_data
from app.core.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.core.rate_limiter import RateLimiter
from app.core.security import (
    create_refresh_token,
    generate_secure_token,
    generate_token_hash,
    hash_password,
)
from app.db.models.essay import Essay, EssayInputType, EssayStatus, EssayType
from app.db.models.user import User, UserPlan, UserType
from app.schemas.appeal import CreateAppealRequest, ResolveAppealRequest
from app.schemas.auth import LoginRequest, RegisterStudentRequest


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
    async def eval(self, *args):
        raise redis.ConnectionError("redis unavailable")

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
async def test_failed_login_counter_survives_http_exception(db_session, monkeypatch):
    async def allow_attempt(*args):
        return True

    monkeypatch.setattr("app.api.v1.endpoints.auth.check_login_attempts", allow_attempt)
    user = _user("login-counter@example.com")
    user_id = user.id
    db_session.add(user)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc:
        await login(
            LoginRequest(email="login-counter@example.com", password="SenhaErrada123!"),
            Request({"type": "http", "client": ("127.0.0.1", 12345), "headers": []}),
            Response(),
            db_session,
            object(),
        )

    assert exc.value.status_code == 401
    db_session.expire(user)
    reloaded = await db_session.get(User, user_id)
    assert reloaded is not None
    assert reloaded.failed_login_attempts == 1


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
        password="SenhaSegura123!",
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
async def test_duplicate_unverified_registration_resends_when_password_matches(
    db_session, monkeypatch
):
    from app.services.email.email_service import EmailService

    existing = _user("pending@example.com")
    existing.is_email_verified = False
    existing.email_verification_token_hash = generate_token_hash("old-token")
    existing.email_verification_expires_at = datetime.now(UTC) - timedelta(hours=1)
    db_session.add(existing)
    await db_session.flush()

    sent_tokens: list[str] = []

    async def capture_email(self, to_email, to_name, verification_token):
        sent_tokens.append(verification_token)

    monkeypatch.setattr(EmailService, "send_verification_email", capture_email)

    result = await create_user(
        db_session,
        full_name="Usuário de Teste",
        email="pending@example.com",
        password="SenhaSegura123",
        user_type=UserType.STUDENT,
    )

    assert result is existing
    assert len(sent_tokens) == 1
    assert existing.email_verification_token_hash == generate_token_hash(sent_tokens[0])
    assert existing.email_verification_expires_at > datetime.now(UTC)


@pytest.mark.asyncio
async def test_email_verification_activates_user_and_invalidates_token(db_session):
    token = generate_secure_token(32)
    user = _user("verify@example.com")
    user.is_email_verified = False
    user.email_verification_token_hash = generate_token_hash(token)
    user.email_verification_expires_at = datetime.now(UTC) + timedelta(hours=1)
    db_session.add(user)
    await db_session.flush()

    response = await verify_email(token, db_session)
    await db_session.commit()
    await db_session.refresh(user)

    assert response.message.startswith("Email verificado")
    assert user.is_email_verified is True
    assert user.email_verification_token_hash is None
    assert user.email_verification_expires_at is None


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
    user.created_at = datetime.now(UTC)
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


def test_personal_log_fields_are_removed_and_user_ids_are_pseudonymized():
    event = {
        "event": "privacy-test",
        "user_id": "raw-user-id",
        "email": "aluno@example.com",
        "essay_content": "Texto integral da redação",
        "theme": "Tema enviado pelo aluno",
    }

    cleaned = remove_sensitive_data(None, "info", event)

    assert cleaned["user_id"] != "raw-user-id"
    assert len(cleaned["user_id"]) == 24
    assert cleaned["email"] == "***REDACTED***"
    assert cleaned["essay_content"] == "***REDACTED***"
    assert cleaned["theme"] == "***REDACTED***"


def production_settings(**overrides):
    values = {
        "SECRET_KEY": "0123456789abcdef" * 4,
        "DATA_ENCRYPTION_KEY": "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "DATABASE_URL": "postgresql+asyncpg://user:pass@postgres/redator",
        "REDIS_URL": "redis://:strong-password@redis:6379/0",
        "ENVIRONMENT": "production",
        "DEBUG": False,
        "FRONTEND_URL": "https://redator.example",
        "ALLOWED_ORIGINS": ["https://redator.example"],
        "OPENAI_API_KEY": "sk-production-test",
        "STRIPE_SECRET_KEY": "sk_test_production",
        "STRIPE_WEBHOOK_SECRET": "whsec_production",
        "STRIPE_PRICE_STANDARD_MONTHLY": "price_standard_monthly",
        "STRIPE_PRICE_STANDARD_QUARTERLY": "price_standard_quarterly",
        "STRIPE_PRICE_PRO_MONTHLY": "price_pro_monthly",
        "STRIPE_PRICE_PRO_QUARTERLY": "price_pro_quarterly",
        "STRIPE_PRICE_TEACHER_30_MONTHLY": "price_teacher_30",
        "STRIPE_PRICE_TEACHER_60_MONTHLY": "price_teacher_60",
        "STRIPE_PRICE_TEACHER_100_MONTHLY": "price_teacher_100",
        "RESEND_API_KEY": "re_production_test",
    }
    values.update(overrides)
    return Settings(**values)


def test_production_rejects_any_insecure_cors_origin():
    with pytest.raises(ValidationError, match="ALLOWED_ORIGINS"):
        production_settings(
            ALLOWED_ORIGINS=[
                "https://redator.example",
                "http://localhost:3000",
            ],
        )


def test_production_requires_tls_for_database_and_redis():
    with pytest.raises(ValidationError, match="DATABASE_URL.*TLS"):
        production_settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@db.example/redator",
            REDIS_URL="rediss://:strong-password@redis.example:6379/0",
        )

    with pytest.raises(ValidationError, match="REDIS_URL.*TLS"):
        production_settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@db.example/redator?ssl=require",
            REDIS_URL="redis://:strong-password@redis.example:6379/0",
        )

    internal = production_settings()
    assert internal.ENVIRONMENT == "production"


@pytest.mark.parametrize(
    "field",
    [
        "OPENAI_API_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRICE_STANDARD_MONTHLY",
        "STRIPE_PRICE_PRO_MONTHLY",
        "STRIPE_PRICE_TEACHER_30_MONTHLY",
        "STRIPE_PRICE_TEACHER_60_MONTHLY",
        "STRIPE_PRICE_TEACHER_100_MONTHLY",
        "RESEND_API_KEY",
    ],
)
def test_production_requires_external_integrations(field):
    with pytest.raises(ValidationError, match=field):
        production_settings(**{field: ""})


def test_production_rejects_placeholder_credentials():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        production_settings(SECRET_KEY="<PREENCHER_SECRET_KEY_DE_PRODUCAO_COM_64_CARACTERES>")

    with pytest.raises(ValidationError, match="DATABASE_URL.*senha real"):
        production_settings(
            DATABASE_URL="postgresql+asyncpg://user:PREENCHER@postgres/redator",
        )

    with pytest.raises(ValidationError, match="REDIS_URL.*autenticação"):
        production_settings(REDIS_URL="redis://:PREENCHER@redis:6379/0")


def test_production_requires_a_separate_database_encryption_key():
    with pytest.raises(ValidationError, match="DATA_ENCRYPTION_KEY"):
        production_settings(DATA_ENCRYPTION_KEY="")


def test_google_vision_endpoint_cannot_redirect_credentials():
    with pytest.raises(ValidationError, match="GOOGLE_VISION_API_ENDPOINT"):
        production_settings(
            GOOGLE_VISION_API_ENDPOINT="https://attacker.example"
        )


def test_teacher_price_id_uses_stripe_price_format():
    with pytest.raises(ValidationError, match="STRIPE_PRICE_TEACHER_30_MONTHLY"):
        production_settings(STRIPE_PRICE_TEACHER_30_MONTHLY="prod_teacher_30")


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


def test_appeal_payload_rejects_mass_assignment_fields():
    with pytest.raises(ValidationError):
        CreateAppealRequest.model_validate(
            {
                "correction_id": str(uuid4()),
                "reason": "Motivo valido com mais de trinta caracteres para analise.",
                "status": "corrected",
                "reviewer_id": str(uuid4()),
                "training_eligible": True,
            }
        )


def test_appeal_text_strips_html_and_control_characters():
    request = CreateAppealRequest(
        correction_id=str(uuid4()),
        reason=(
            "<script>alert('xss')</script> Motivo detalhado da contestacao"
            "\x00\x07 com texto adicional suficiente."
        ),
    )
    resolution = ResolveAppealRequest(
        decision="upheld",
        explanation=(
            "<img src=x onerror=alert(1)> A decisao foi fundamentada com base "
            "nos criterios da avaliacao e nos trechos apresentados.\x00"
        ),
    )

    assert "<" not in request.reason and ">" not in request.reason
    assert "\x00" not in request.reason and "\x07" not in request.reason
    assert "<" not in resolution.explanation and ">" not in resolution.explanation
    assert "\x00" not in resolution.explanation


def test_appeal_scores_reject_nan_infinity_and_duplicate_competencies():
    for invalid_score in (float("nan"), float("inf"), float("-inf")):
        with pytest.raises(ValidationError):
            ResolveAppealRequest(
                decision="corrected",
                explanation=(
                    "Parecer suficientemente longo para validar a rejeicao de valores "
                    "numericos nao finitos enviados por um cliente malicioso."
                ),
                corrected_total_score=invalid_score,
            )

    with pytest.raises(ValidationError):
        ResolveAppealRequest(
            decision="corrected",
            explanation=(
                "Parecer suficientemente longo para validar competencias duplicadas "
                "enviadas deliberadamente no mesmo payload de decisao."
            ),
            corrected_total_score=320,
            competency_scores=[
                {"number": 1, "score": 160},
                {"number": 1, "score": 160},
            ],
        )


@pytest.mark.asyncio
async def test_refresh_token_cannot_be_used_as_access_token():
    with pytest.raises(HTTPException) as exc:
        await get_current_user_id(
            access_token=create_refresh_token(str(uuid4())),
            request=None,
        )
    assert exc.value.status_code == 401


def test_production_auth_cookies_are_secure_and_scope_refresh(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    response = Response()
    set_auth_cookies(response, "access-secret", "refresh-secret")
    cookies = response.headers.getlist("set-cookie")

    assert len(cookies) == 2
    assert all("HttpOnly" in cookie for cookie in cookies)
    assert all("Secure" in cookie for cookie in cookies)
    assert all("SameSite=strict" in cookie for cookie in cookies)
    refresh_cookie = next(cookie for cookie in cookies if cookie.startswith("refresh_token="))
    assert "Path=/api/v1/auth/refresh" in refresh_cookie


@pytest.mark.asyncio
async def test_stripe_handler_failure_returns_retryable_error(monkeypatch, db_session):
    import app.api.v1.endpoints.stripe as stripe_endpoint

    monkeypatch.setattr(
        stripe_endpoint.stripe.Webhook,
        "construct_event",
        lambda payload, signature, secret: {
            "type": "checkout.session.completed",
            "data": {"object": {"id": "cs_test"}},
        },
    )

    async def failing_handler(session, db):
        raise RuntimeError("temporary database failure")

    monkeypatch.setattr(stripe_endpoint, "_handle_checkout_completed", failing_handler)

    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": b"{}", "more_body": False}

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/webhooks/stripe",
            "headers": [(b"stripe-signature", b"valid-test-signature")],
        },
        receive,
    )

    with pytest.raises(HTTPException) as exc:
        await stripe_webhook(request, db_session)
    assert exc.value.status_code == 503
