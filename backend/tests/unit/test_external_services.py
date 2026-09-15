"""Contratos dos adaptadores externos sem realizar chamadas de rede."""
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image
from starlette.datastructures import Headers

from app.api.v1.endpoints.essays import (
    _issue_ocr_review_token,
    _resolve_input_type,
    extract_essay_photo,
)
from app.core.config import settings
from app.db.models.essay import EssayInputType, EssayType
from app.db.models.user import User, UserPlan
from app.services.email.email_service import EmailService
from app.services.ocr.ocr_service import OCRService
from app.services.stripe.stripe_service import StripeService
from app.services.teacher_plans import normalize_teacher_capacity, public_teacher_slots


class FakeReviewRedis:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.expirations: dict[str, int] = {}

    async def set(self, key: str, value: str, *, ex: int) -> None:
        self.values[key] = value
        self.expirations[key] = ex

    async def get(self, key: str):
        return self.values.get(key)

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)


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


@pytest.mark.asyncio
async def test_ocr_uses_openai_when_google_credentials_fail(monkeypatch):
    service = OCRService()
    monkeypatch.setattr(
        service,
        "_google_ocr_sync",
        lambda _image: (_ for _ in ()).throw(RuntimeError("sem credencial")),
    )
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    service._openai_ocr = AsyncMock(return_value="Texto reconhecido")

    assert await service.extract_text(b"imagem") == "Texto reconhecido"
    service._openai_ocr.assert_awaited_once_with(b"imagem")


@pytest.mark.asyncio
async def test_openai_ocr_sends_private_image_without_storage(monkeypatch):
    captured: dict = {}

    class FakeResponses:
        async def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(status="completed", output_text="Redação transcrita")

    client = SimpleNamespace(responses=FakeResponses())
    service = OCRService(openai_client=client)
    monkeypatch.setattr(settings, "OPENAI_OCR_MODEL", "vision-test")
    jpeg = b"\xff\xd8\xff" + b"conteudo-da-imagem"

    assert await service._openai_ocr(jpeg) == "Redação transcrita"
    assert captured["model"] == "vision-test"
    assert captured["store"] is False
    image_part = captured["input"][0]["content"][1]
    assert image_part["type"] == "input_image"
    assert image_part["image_url"].startswith("data:image/jpeg;base64,")


def test_ocr_truncates_untrusted_provider_output():
    result = OCRService()._sanitize_extracted_text("a" * 16_000)
    assert len(result) == 15_000


@pytest.mark.asyncio
async def test_photo_extraction_returns_reviewable_text_without_creating_essay(monkeypatch):
    image = Image.new("RGB", (80, 80), "white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    async def allow_rate_limit(*_args, **_kwargs):
        return True

    async def reserve_ocr_credit(*_args, **kwargs):
        assert kwargs["resource"] == "ocr_extractions"
        return True, 1, 30, 0

    async def extract_text(_self, _content):
        return "Texto reconhecido para o aluno revisar antes da avaliação final."

    monkeypatch.setattr(
        "app.api.v1.endpoints.essays.RateLimiter.check", allow_rate_limit
    )
    monkeypatch.setattr(
        "app.api.v1.endpoints.essays.reserve_monthly_credit", reserve_ocr_credit
    )
    monkeypatch.setattr(OCRService, "extract_text", extract_text)

    upload = UploadFile(
        file=io.BytesIO(buffer.getvalue()),
        filename="redacao.png",
        headers=Headers({"content-type": "image/png"}),
    )
    user = SimpleNamespace(
        id=uuid4(),
        plan=UserPlan.PRO,
        user_type=SimpleNamespace(value="student"),
    )

    redis_client = FakeReviewRedis()
    response = await extract_essay_photo(
        essay_type=EssayType.ENEM,
        photo=upload,
        current_user=user,
        redis_client=redis_client,
    )

    assert response.content.startswith("Texto reconhecido")
    assert response.word_count == 10
    assert len(response.review_token) >= 32
    assert redis_client.expirations


@pytest.mark.asyncio
async def test_ocr_origin_requires_token_bound_to_user_and_essay_type():
    redis_client = FakeReviewRedis()
    user_id = str(uuid4())
    token = await _issue_ocr_review_token(redis_client, user_id, EssayType.ENEM)

    assert await _resolve_input_type(
        redis_client, None, user_id, EssayType.ENEM
    ) == EssayInputType.TEXT
    assert await _resolve_input_type(
        redis_client, token, user_id, EssayType.ENEM
    ) == EssayInputType.PHOTO

    with pytest.raises(HTTPException) as wrong_user:
        await _resolve_input_type(
            redis_client, token, str(uuid4()), EssayType.ENEM
        )
    assert wrong_user.value.status_code == 422

    with pytest.raises(HTTPException) as wrong_type:
        await _resolve_input_type(
            redis_client, token, user_id, EssayType.VESTIBULAR
        )
    assert wrong_type.value.status_code == 422


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
