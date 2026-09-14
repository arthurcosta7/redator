"""Contratos dos adaptadores externos sem realizar chamadas de rede."""
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.config import settings
from app.db.models.user import User, UserPlan
from app.services.email.email_service import EmailService
from app.services.ocr.ocr_service import OCRService
from app.services.stripe.stripe_service import StripeService
from app.services.teacher_plans import normalize_teacher_capacity, public_teacher_slots


@pytest.mark.asyncio
async def test_verification_email_escapes_name_and_builds_expected_link(monkeypatch):
    sent: list[dict] = []
    monkeypatch.setattr("resend.Emails.send", lambda params: sent.append(params))
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://redator.test")

    await EmailService().send_verification_email(
        "aluno@teste.com",
        "<script>alert(1)</script> Silva",
        "token-seguro",
    )

    assert len(sent) == 1
    assert sent[0]["to"] == ["aluno@teste.com"]
    assert "https://redator.test/auth/verify-email/token-seguro" in sent[0]["html"]
    assert "<script>" not in sent[0]["html"]
    assert "&lt;script&gt;" in sent[0]["html"]


@pytest.mark.asyncio
async def test_password_reset_email_contains_token_and_recipient(monkeypatch):
    sent: list[dict] = []
    monkeypatch.setattr("resend.Emails.send", lambda params: sent.append(params))
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://redator.test")

    await EmailService().send_password_reset_email(
        "aluno@teste.com", "Aluno", "reset-token"
    )

    assert "https://redator.test/auth/reset-password/reset-token" in sent[0]["html"]
    assert "aluno@teste.com" in sent[0]["html"]


@pytest.mark.asyncio
async def test_email_provider_error_is_propagated(monkeypatch):
    def fail(_params):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr("resend.Emails.send", fail)
    with pytest.raises(RuntimeError, match="provider unavailable"):
        await EmailService().send_password_reset_email("a@b.com", "A", "token")


@pytest.mark.asyncio
async def test_ocr_normalizes_control_characters_and_spacing(monkeypatch):
    monkeypatch.setattr(
        OCRService,
        "_google_ocr_sync",
        staticmethod(lambda _image: "  Primeira   linha\x00\n\n Segunda linha  "),
    )
    result = await OCRService().extract_text(b"imagem")
    assert result == "Primeira linha\nSegunda linha"


def test_ocr_truncates_untrusted_provider_output():
    result = OCRService()._sanitize_extracted_text("a" * 16_000)
    assert len(result) == 15_000


def test_stripe_maps_all_supported_prices_and_rejects_invalid(monkeypatch):
    prices = {
        "STRIPE_PRICE_STANDARD_MONTHLY": "price_std_month",
        "STRIPE_PRICE_STANDARD_QUARTERLY": "price_std_quarter",
        "STRIPE_PRICE_PRO_MONTHLY": "price_pro_month",
        "STRIPE_PRICE_PRO_QUARTERLY": "price_pro_quarter",
        "STRIPE_PRICE_TEACHER_30_MONTHLY": "price_teacher_30",
        "STRIPE_PRICE_TEACHER_60_MONTHLY": "price_teacher_60",
        "STRIPE_PRICE_TEACHER_100_MONTHLY": "price_teacher_100",
        "STRIPE_PRICE_TEACHER_PACKAGE": "price_teacher_legacy",
    }
    for name, value in prices.items():
        monkeypatch.setattr(settings, name, value)

    service = StripeService()
    assert service.get_price_id("STANDARD", "MENSAL") == "price_std_month"
    assert service.get_price_id("pro", "mensal") == "price_pro_month"
    assert service.get_price_id("teacher_60", "mensal") == "price_teacher_60"
    assert service.price_to_teacher_slots("price_teacher_100") == 100
    assert service.price_to_teacher_slots("price_teacher_legacy") == 30
    assert service.price_to_plan("price_std_quarter") == UserPlan.STANDARD
    assert service.price_to_plan("price_pro_month") == UserPlan.PRO
    assert service.price_to_plan("price_unknown") == UserPlan.FREE
    with pytest.raises(ValueError, match="Plano ou período inválido"):
        service.get_price_id("enterprise", "anual")


def test_legacy_teacher_capacity_moves_to_next_commercial_tier():
    assert normalize_teacher_capacity(0) == 3
    assert normalize_teacher_capacity(10) == 30
    assert normalize_teacher_capacity(40) == 60
    assert normalize_teacher_capacity(70) == 100
    assert normalize_teacher_capacity(120) == 120
    assert public_teacher_slots(0) == 0
    assert public_teacher_slots(20) == 30


@pytest.mark.asyncio
async def test_stripe_reuses_customer_and_creates_missing_one(monkeypatch):
    service = StripeService()
    existing = User(
        id=uuid4(), full_name="Existente", email="existente@teste.com",
        hashed_password="hash", stripe_customer_id="cus_existing",
    )
    assert await service.get_or_create_customer(existing) == "cus_existing"

    captured: dict = {}

    def create_customer(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(id="cus_new")

    monkeypatch.setattr("stripe.Customer.create", create_customer)
    new_user = User(
        id=uuid4(), full_name="Novo Usuário", email="novo@teste.com",
        hashed_password="hash",
    )
    assert await service.get_or_create_customer(new_user) == "cus_new"
    assert captured["metadata"] == {"user_id": str(new_user.id)}


@pytest.mark.asyncio
async def test_stripe_session_adapters_return_provider_urls(monkeypatch):
    monkeypatch.setattr(
        "stripe.checkout.Session.create",
        lambda **_kwargs: SimpleNamespace(url="https://checkout.test/session"),
    )
    monkeypatch.setattr(
        "stripe.billing_portal.Session.create",
        lambda **_kwargs: SimpleNamespace(url="https://portal.test/session"),
    )
    service = StripeService()
    assert await service.create_checkout_session(
        "cus_1", "price_1", "https://ok", "https://cancel"
    ) == "https://checkout.test/session"
    assert await service.create_portal_session(
        "cus_1", "https://return"
    ) == "https://portal.test/session"
