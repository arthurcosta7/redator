"""Permissões, sessão, CRM e métricas da nova operação comercial."""
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.core.dependencies import get_db, get_redis
from app.core.marketing_session import marketing_session_key
from app.core.rate_limiter import RateLimiter
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.db.models.marketing import MarketingLead
from app.db.models.referral import ReferralAttribution, ReferralClick, ReferralLink
from app.db.models.user import AdminRole, User, UserPlan, UserType
from app.main import app
from app.services.referrals import attribute_signup, mark_paid_conversion


class IdleRedis:
    def __init__(self):
        self.values = {}

    async def setex(self, key, ttl, value):
        self.values[key] = value

    async def getex(self, key, *, ex):
        return self.values.get(key)


def person(email: str, role: AdminRole | None = None) -> User:
    return User(
        id=uuid4(), full_name=email.split("@")[0], email=email,
        hashed_password=hash_password("SenhaSegura123!"),
        user_type=UserType.STUDENT, plan=UserPlan.FREE,
        is_active=True, is_email_verified=True, admin_role=role,
    )


def authenticate(client, user: User, redis: IdleRedis, *, idle: bool = True):
    access = create_access_token(str(user.id), "student", "free")
    refresh = create_refresh_token(str(user.id))
    client.cookies.set("access_token", access)
    client.cookies.set("refresh_token", refresh)
    if idle:
        redis.values[marketing_session_key(refresh)] = str(user.id)


@pytest.mark.asyncio
async def test_seller_leads_are_private_and_manager_can_filter(db_session, client):
    seller_a = person("seller-a@example.com", AdminRole.SALES)
    seller_b = person("seller-b@example.com", AdminRole.SALES)
    manager = person("manager@example.com", AdminRole.MARKETING_MANAGER)
    outsider = person("outsider@example.com")
    db_session.add_all([seller_a, seller_b, manager, outsider])
    await db_session.flush()
    redis = IdleRedis()

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_redis] = lambda: redis
    try:
        authenticate(client, seller_a, redis)
        response = await client.post("/api/v1/marketing/leads", json={
            "name": "Contato A", "email": "contato@example.com", "notes": "Primeira conversa",
            "consent_confirmed": True,
        })
        assert response.status_code == 201, response.text
        lead_id = response.json()["id"]
        forbidden_owner = await client.post("/api/v1/marketing/leads", json={
            "name": "Contato B", "consent_confirmed": True, "owner_id": str(seller_b.id),
        })
        assert forbidden_owner.status_code == 403
        no_consent = await client.post("/api/v1/marketing/leads", json={
            "name": "Contato B", "consent_confirmed": False,
        })
        assert no_consent.status_code == 422

        authenticate(client, seller_b, redis)
        own_list = await client.get("/api/v1/marketing/leads")
        assert own_list.status_code == 200
        assert own_list.json()["total"] == 0
        assert "contato@example.com" not in own_list.text
        assert (await client.patch(f"/api/v1/marketing/leads/{lead_id}", json={"status": "converted"})).status_code == 404
        assert (await client.get("/api/v1/marketing/leads", params={"owner_id": str(seller_a.id)})).status_code == 403

        authenticate(client, manager, redis)
        manager_list = await client.get("/api/v1/marketing/leads", params={"owner_id": str(seller_a.id)})
        assert manager_list.status_code == 200
        assert manager_list.json()["total"] == 1
        edited = await client.patch(f"/api/v1/marketing/leads/{lead_id}", json={"status": "contacted", "notes": "Retorno solicitado"})
        assert edited.status_code == 200
        assert edited.json()["status"] == "contacted"
        stored = await db_session.get(MarketingLead, UUID(lead_id))
        assert stored.consent_recorded_at is not None

        authenticate(client, outsider, redis)
        assert (await client.get("/api/v1/marketing/leads")).status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_marketing_idle_session_expires_and_admin_data_is_denied(db_session, client):
    seller = person("seller@example.com", AdminRole.SALES)
    db_session.add(seller)
    await db_session.flush()
    redis = IdleRedis()

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_redis] = lambda: redis
    try:
        authenticate(client, seller, redis, idle=False)
        assert (await client.get("/api/v1/marketing/dashboard")).status_code == 401
        authenticate(client, seller, redis)
        assert (await client.get("/api/v1/marketing/dashboard")).status_code == 200
        assert (await client.get("/api/v1/admin/users")).status_code == 403
        assert (await client.get("/api/v1/admin/referrals")).status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_seller_link_tracks_click_signup_and_first_payment(db_session, client, monkeypatch):
    seller = person("seller@example.com", AdminRole.SALES)
    referred = person("referred@example.com")
    db_session.add_all([seller, referred])
    await db_session.flush()
    redis = IdleRedis()

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_redis] = lambda: redis
    monkeypatch.setattr(settings, "REFERRAL_CLICK_SECRET", "a" * 40)
    calls = 0

    async def limited_check(self, action, identifier, max_requests, window_seconds):
        nonlocal calls
        calls += 1
        return calls <= 100

    monkeypatch.setattr(RateLimiter, "check", limited_check)
    try:
        authenticate(client, seller, redis)
        created = await client.post("/api/v1/marketing/referrals")
        assert created.status_code == 201
        link = (await db_session.execute(select(ReferralLink))).scalar_one()
        assert (await client.post("/api/v1/marketing/referrals")).json()["id"] == str(link.id)
        click_url = "/api/v1/marketing/referrals/click"
        payload = {"code": link.code}
        assert (await client.post(click_url, json=payload, headers={"X-Referral-Visitor": "b" * 64})).status_code == 403
        headers = {"X-Referral-Click-Secret": "a" * 40, "X-Referral-Visitor": "b" * 64}
        for _ in range(100):
            assert (await client.post(click_url, json=payload, headers=headers)).status_code == 204
        assert (await client.post(click_url, json=payload, headers=headers)).status_code == 429
        assert len((await db_session.execute(select(ReferralClick))).scalars().all()) == 100
        await attribute_signup(db_session, None, referred, link.code, "", None)
        await db_session.flush()
        await mark_paid_conversion(db_session, referred.id, 1899)
        await mark_paid_conversion(db_session, referred.id, 9999)
        attribution = (await db_session.execute(select(ReferralAttribution))).scalar_one()
        assert attribution.first_payment_cents == 1899
        dashboard = await client.get("/api/v1/marketing/dashboard")
        assert dashboard.status_code == 200
        assert dashboard.json()["clicks"] == 100
        assert dashboard.json()["signups"] == 1
        assert dashboard.json()["paid_conversions"] == 1
        assert dashboard.json()["first_payment_cents"] == 1899
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_weekly_report_sends_private_seller_rows_and_manager_summary(db_session, monkeypatch):
    from app.jobs import marketing_weekly_report as report

    seller_a = person("seller-a@example.com", AdminRole.SALES)
    seller_b = person("seller-b@example.com", AdminRole.SALES)
    manager = person("manager@example.com", AdminRole.MARKETING_MANAGER)
    db_session.add_all([seller_a, seller_b, manager])
    await db_session.flush()
    link_a = ReferralLink(code="a" * 48, owner_id=seller_a.id, created_by_id=manager.id, is_active=True)
    link_b = ReferralLink(code="b" * 48, owner_id=seller_b.id, created_by_id=manager.id, is_active=True)
    db_session.add_all([link_a, link_b])
    await db_session.flush()
    db_session.add(ReferralClick(link_id=link_a.id))
    db_session.add(MarketingLead(
        owner_id=seller_a.id, name="Contato privado", email="contato@example.com",
        status="new", consent_recorded_at=datetime.now(UTC),
    ))
    await db_session.flush()
    emails = {}

    @asynccontextmanager
    async def session_factory():
        yield db_session

    async def fake_send(self, to_email, subject, html_content):
        emails[to_email] = html_content

    monkeypatch.setattr(report, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(report.EmailService, "_send", fake_send)
    monkeypatch.setattr(settings, "RESEND_API_KEY", "test-key")
    await report.send_marketing_weekly_report({})
    assert set(emails) == {seller_a.email, seller_b.email, manager.email}
    assert seller_b.full_name not in emails[seller_a.email]
    assert seller_a.full_name in emails[manager.email]
    assert seller_b.full_name in emails[manager.email]
    assert "contato@example.com" not in str(emails)
