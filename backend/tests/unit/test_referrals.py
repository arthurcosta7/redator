"""Regressões de atribuição, fraude, conversão e controle de acesso."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.api.v1.endpoints.auth import create_user
from app.api.v1.endpoints.referrals import ReviewRequest, list_links, review_attribution
from app.api.v1.endpoints.stripe import _handle_invoice_paid
from app.core.client_ip import client_ip
from app.core.dependencies import get_db
from app.core.security import create_access_token, hash_password
from app.db.models.referral import ReferralAttribution, ReferralLink
from app.db.models.subscription import Subscription, SubscriptionStatus
from app.db.models.user import AdminRole, User, UserPlan, UserType
from app.main import app
from app.services.referrals import attribute_signup, mark_paid_conversion


class SignalRedis:
    def __init__(self):
        self.values = {}

    async def set(self, key, value, *, ex, nx):
        assert ex == 90 * 24 * 60 * 60
        assert nx is True
        assert "192.0.2" not in key
        if key in self.values:
            return False
        self.values[key] = value
        return True


def user(email, role=None):
    return User(
        id=uuid4(), full_name="Pessoa de Teste", email=email,
        hashed_password=hash_password("SenhaSegura123!"),
        user_type=UserType.STUDENT, plan=UserPlan.FREE,
        is_active=True, is_email_verified=True, admin_role=role,
    )


async def setup_link(db):
    owner = user("owner@example.com")
    admin = user("admin@example.com", AdminRole.ADMIN)
    db.add_all([owner, admin])
    await db.flush()
    link = ReferralLink(code="a" * 48, owner_id=owner.id, created_by_id=admin.id, is_active=True)
    db.add(link)
    await db.flush()
    return owner, admin, link


@pytest.mark.asyncio
async def test_signup_attribution_is_one_per_account_and_invalid_links_are_ignored(db_session):
    _, _, link = await setup_link(db_session)
    redis = SignalRedis()
    first = user("first@example.com")
    db_session.add(first)
    await db_session.flush()
    await attribute_signup(db_session, redis, first, link.code, "192.0.2.1", str(uuid4()))
    await db_session.flush()
    attribution = (await db_session.execute(select(ReferralAttribution))).scalar_one()
    assert attribution.user_id == first.id
    assert attribution.status == "valid"
    await mark_paid_conversion(db_session, first.id)
    converted_at = attribution.converted_at
    await mark_paid_conversion(db_session, first.id)
    assert attribution.converted_at == converted_at

    second = user("second@example.com")
    db_session.add(second)
    await db_session.flush()
    await attribute_signup(db_session, redis, second, "b" * 48, "192.0.2.2", None)
    assert (await db_session.execute(select(ReferralAttribution))).scalars().all() == [attribution]


@pytest.mark.asyncio
async def test_shared_network_and_device_require_review_without_blocking_signup(db_session):
    _, admin, link = await setup_link(db_session)
    redis = SignalRedis()
    first, second, third = [user(f"person{n}@example.com") for n in range(3)]
    db_session.add_all([first, second, third])
    await db_session.flush()
    device = str(uuid4())
    await attribute_signup(db_session, redis, first, link.code, "192.0.2.1", device)
    await attribute_signup(db_session, redis, second, link.code, "192.0.2.1", str(uuid4()))
    await attribute_signup(db_session, redis, third, link.code, "192.0.2.2", device)
    await db_session.flush()
    values = (await db_session.execute(select(ReferralAttribution).order_by(ReferralAttribution.user_id))).scalars().all()
    by_user = {item.user_id: item for item in values}
    assert by_user[first.id].status == "valid"
    assert by_user[second.id].risk_reason == "shared_network"
    assert by_user[third.id].risk_reason == "shared_device"
    for person in (first, second, third):
        await mark_paid_conversion(db_session, person.id)
    totals = await list_links(admin, db_session)
    assert totals[0].signups == 3
    assert totals[0].valid_signups == 1
    assert totals[0].pending_review == 2
    assert totals[0].paid_conversions == 1


@pytest.mark.asyncio
async def test_disabled_link_cannot_attribute_signup(db_session):
    _, _, link = await setup_link(db_session)
    link.is_active = False
    person = user("new@example.com")
    db_session.add(person)
    await db_session.flush()
    await attribute_signup(db_session, SignalRedis(), person, link.code, "192.0.2.3", None)
    assert (await db_session.execute(select(ReferralAttribution))).scalars().all() == []


@pytest.mark.asyncio
async def test_verification_resend_cannot_change_original_referral(db_session, monkeypatch):
    from app.services.email.email_service import EmailService

    async def noop_email(self, **kwargs):
        return None

    monkeypatch.setattr(EmailService, "send_verification_email", noop_email)
    owner, _, link = await setup_link(db_session)
    redis = SignalRedis()
    first = await create_user(
        db_session, full_name="Pessoa Indicada", email="pending@example.com",
        password="SenhaSegura123!", user_type=UserType.STUDENT,
        referral_code=link.code, registration_ip="192.0.2.1", redis_client=redis,
    )
    assert first is not None
    await create_user(
        db_session, full_name="Pessoa Indicada", email="pending@example.com",
        password="SenhaSegura123!", user_type=UserType.STUDENT,
        referral_code="b" * 48, registration_ip="192.0.2.2", redis_client=redis,
    )
    records = (await db_session.execute(select(ReferralAttribution))).scalars().all()
    assert len(records) == 1
    assert records[0].user_id == first.id
    assert records[0].link_id == link.id
    assert owner.id == link.owner_id


@pytest.mark.asyncio
async def test_review_approval_unlocks_paid_conversion_count(db_session):
    _, admin, link = await setup_link(db_session)
    redis = SignalRedis()
    first, second = user("first@example.com"), user("second@example.com")
    db_session.add_all([first, second])
    await db_session.flush()
    await attribute_signup(db_session, redis, first, link.code, "192.0.2.1", None)
    await attribute_signup(db_session, redis, second, link.code, "192.0.2.1", None)
    await db_session.flush()
    await mark_paid_conversion(db_session, second.id)
    before = await list_links(admin, db_session)
    assert before[0].paid_conversions == 0
    record = (await db_session.execute(select(ReferralAttribution).where(
        ReferralAttribution.user_id == second.id
    ))).scalar_one()
    await review_attribution(record.id, ReviewRequest(status="valid"), admin, db_session)
    after = await list_links(admin, db_session)
    assert after[0].paid_conversions == 1


@pytest.mark.asyncio
async def test_referral_admin_endpoint_denies_normal_user_and_analyst(db_session, client):
    ordinary = user("ordinary@example.com")
    analyst = user("analyst@example.com", AdminRole.ANALYST)
    admin = user("admin@example.com", AdminRole.ADMIN)
    db_session.add_all([ordinary, analyst, admin])
    await db_session.flush()

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    try:
        for account, expected in ((ordinary, 403), (analyst, 403), (admin, 201)):
            token = create_access_token(str(account.id), "student", "free")
            client.cookies.set("access_token", token)
            response = await client.post(
                "/api/v1/admin/referrals", json={"owner_id": str(ordinary.id)},
            )
            assert response.status_code == expected
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_invoice_paid_counts_only_positive_subscription_payment(db_session):
    _, _, link = await setup_link(db_session)
    person = user("payer@example.com")
    db_session.add(person)
    await db_session.flush()
    await attribute_signup(db_session, SignalRedis(), person, link.code, "192.0.2.1", None)
    db_session.add(Subscription(
        user_id=person.id, stripe_subscription_id="sub_referral_test",
        stripe_customer_id="cus_referral_test", stripe_price_id="price_referral_test",
        status=SubscriptionStatus.ACTIVE,
        current_period_start=datetime.now(UTC),
        current_period_end=datetime.now(UTC) + timedelta(days=30),
    ))
    await db_session.flush()
    await _handle_invoice_paid({"subscription": "sub_referral_test", "amount_paid": 0}, db_session)
    attribution = (await db_session.execute(select(ReferralAttribution))).scalar_one()
    assert attribution.converted_at is None
    await _handle_invoice_paid({"subscription": "sub_referral_test", "amount_paid": 1899}, db_session)
    first_time = attribution.converted_at
    assert first_time is not None
    await _handle_invoice_paid({"subscription": "sub_referral_test", "amount_paid": 1899}, db_session)
    assert attribution.converted_at == first_time


def test_proxy_header_is_used_only_when_enabled_and_peer_is_private(monkeypatch):
    from starlette.requests import Request

    from app.core.config import settings

    def request(peer):
        return Request({
            "type": "http", "method": "GET", "path": "/",
            "headers": [(b"x-real-ip", b"203.0.113.4")],
            "client": (peer, 1234), "server": ("localhost", 8000),
        })

    monkeypatch.setattr(settings, "TRUST_PROXY_REAL_IP", False)
    assert client_ip(request("172.20.0.1")) == "172.20.0.1"
    monkeypatch.setattr(settings, "TRUST_PROXY_REAL_IP", True)
    assert client_ip(request("172.20.0.1")) == "203.0.113.4"
    assert client_ip(request("8.8.8.8")) == "8.8.8.8"
