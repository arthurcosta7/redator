"""
stripe.py — Endpoints de pagamento e assinatura

Rotas:
- POST /checkout/session    — Cria Checkout Session → retorna URL do Stripe
- POST /checkout/portal     — Cria Portal Session → retorna URL do portal de billing
- GET  /subscription        — Status da assinatura do usuário
- POST /webhooks/stripe     — Webhook handler (chamado pelo Stripe, não pelo usuário)
"""
from datetime import datetime, timezone
from typing import Annotated, Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db
from app.core.logging import get_logger
from app.db.models.subscription import Subscription, SubscriptionStatus
from app.db.models.user import User, UserPlan, UserType
from app.services.product_analytics import track_product_event
from app.services.referrals import mark_paid_conversion
from app.services.stripe.stripe_service import StripeService

router = APIRouter(tags=["Pagamentos"])
logger = get_logger(__name__)

# Mapeamento entre status do Stripe e enum da aplicação
_STRIPE_STATUS_MAP: dict[str, SubscriptionStatus] = {
    "active":     SubscriptionStatus.ACTIVE,
    "canceled":   SubscriptionStatus.CANCELLED,
    "cancelled":  SubscriptionStatus.CANCELLED,
    "past_due":   SubscriptionStatus.PAST_DUE,
    "trialing":   SubscriptionStatus.TRIALING,
    "incomplete": SubscriptionStatus.INCOMPLETE,
}


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: Literal["standard", "pro", "teacher_30", "teacher_60", "teacher_100"]
    period: Literal["mensal"] = "mensal"


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


class SubscriptionStatusResponse(BaseModel):
    plan: str
    status: str | None
    current_period_end: str | None


# ─── Checkout ─────────────────────────────────────────────────────────────────

@router.post("/checkout/session", response_model=CheckoutResponse)
async def create_checkout_session(
    data: CheckoutRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckoutResponse:
    """
    Cria uma Stripe Checkout Session e retorna a URL de redirecionamento.

    O frontend deve redirecionar o usuário para checkout_url.
    Após o pagamento, o Stripe redireciona para /checkout/sucesso.
    """
    service = StripeService()

    try:
        is_teacher_plan = data.plan.startswith("teacher_")
        if is_teacher_plan != (current_user.user_type == UserType.TEACHER):
            raise ValueError("Este plano não está disponível para o seu tipo de conta.")
        price_id = service.get_price_id(data.plan, data.period)
        customer_id = await service.get_or_create_customer(current_user)

        if not current_user.stripe_customer_id:
            current_user.stripe_customer_id = customer_id
            await db.flush()

        dashboard_path = "professor" if is_teacher_plan else "aluno"
        success_url = (
            f"{settings.FRONTEND_URL}/checkout/sucesso?destino={dashboard_path}"
            "&session_id={CHECKOUT_SESSION_ID}"
        )
        cancel_url = (
            f"{settings.FRONTEND_URL}/checkout/cancelado?destino={dashboard_path}"
        )

        checkout_url = await service.create_checkout_session(
            customer_id=customer_id,
            price_id=price_id,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except stripe.StripeError as e:
        logger.error("erro_stripe_checkout", error=str(e), user_id=str(current_user.id))
        raise HTTPException(status_code=502, detail="Erro ao criar sessão de pagamento.")

    logger.info("checkout_session_criada", user_id=str(current_user.id), plan=data.plan)
    track_product_event(
        logger, "checkout_started", user_id=str(current_user.id),
        account_type=current_user.user_type.value, plan=data.plan,
    )
    return CheckoutResponse(checkout_url=checkout_url)


@router.post("/checkout/portal", response_model=PortalResponse)
async def create_portal_session(
    current_user: Annotated[User, Depends(get_current_user)],
) -> PortalResponse:
    """
    Cria uma Stripe Billing Portal Session.

    Permite ao usuário cancelar, trocar plano ou atualizar cartão
    sem precisar de implementação customizada.
    """
    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="Nenhuma assinatura ativa encontrada.",
        )

    service = StripeService()
    try:
        portal_url = await service.create_portal_session(
            customer_id=current_user.stripe_customer_id,
            return_url=(
                f"{settings.FRONTEND_URL}/dashboard/professor/plano"
                if current_user.user_type == UserType.TEACHER
                else f"{settings.FRONTEND_URL}/dashboard/aluno/plano"
            ),
        )
    except stripe.StripeError as e:
        logger.error("erro_stripe_portal", error=str(e), user_id=str(current_user.id))
        raise HTTPException(status_code=502, detail="Erro ao acessar portal de pagamento.")

    return PortalResponse(portal_url=portal_url)


# ─── Status da assinatura ────────────────────────────────────────────────────

@router.get("/subscription", response_model=SubscriptionStatusResponse)
async def get_subscription_status(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SubscriptionStatusResponse:
    """Retorna o plano atual e status da assinatura do usuário."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    return SubscriptionStatusResponse(
        plan=current_user.plan.value,
        status=sub.status.value if sub else None,
        current_period_end=sub.current_period_end.isoformat() if sub else None,
    )


# ─── Webhook ──────────────────────────────────────────────────────────────────

@router.post("/webhooks/stripe", status_code=200)
async def stripe_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Recebe eventos do Stripe e sincroniza o estado das assinaturas.

    SEGURANÇA: A assinatura do webhook é verificada antes de qualquer
    processamento. Requisições sem assinatura válida são rejeitadas com 400.

    Não usa get_current_user — o Stripe chama diretamente sem cookie de sessão.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        logger.warning("webhook_assinatura_invalida")
        raise HTTPException(status_code=400, detail="Assinatura inválida.")
    except Exception as e:
        logger.error("webhook_parse_error", error=str(e))
        raise HTTPException(status_code=400, detail="Payload inválido.")

    event_type = event["type"]
    logger.info("webhook_recebido", event_type=event_type)

    try:
        if event_type == "checkout.session.completed":
            await _handle_checkout_completed(event["data"]["object"], db)
        elif event_type == "customer.subscription.updated":
            await _handle_subscription_updated(event["data"]["object"], db)
        elif event_type == "customer.subscription.deleted":
            await _handle_subscription_deleted(event["data"]["object"], db)
        elif event_type == "invoice.payment_failed":
            await _handle_payment_failed(event["data"]["object"], db)
        elif event_type == "invoice.paid":
            await _handle_invoice_paid(event["data"]["object"], db)
    except Exception as e:
        logger.error("webhook_handler_error", event_type=event_type, error=str(e))
        # Resposta nao-2xx faz o Stripe repetir com backoff. Confirmar recebimento
        # sem persistir o evento causaria perda silenciosa de pagamentos/planos.
        raise HTTPException(
            status_code=503,
            detail="Evento temporariamente não processado.",
        )

    return {"received": True}


# ─── Handlers internos do webhook ────────────────────────────────────────────

async def _handle_checkout_completed(session: dict, db: AsyncSession) -> None:
    """Pagamento concluído: cria/atualiza assinatura e sobe o plano do usuário."""
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")

    if not subscription_id:
        return

    service = StripeService()
    stripe_sub = await service.retrieve_subscription(subscription_id)
    price_id = stripe_sub["items"]["data"][0]["price"]["id"]
    plan = service.price_to_plan(price_id)
    teacher_slots = service.price_to_teacher_slots(price_id)

    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        logger.warning("webhook_usuario_nao_encontrado", customer_id=customer_id)
        return

    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = sub_result.scalar_one_or_none()

    period_start = datetime.fromtimestamp(stripe_sub["current_period_start"], tz=timezone.utc)
    period_end = datetime.fromtimestamp(stripe_sub["current_period_end"], tz=timezone.utc)

    if sub:
        sub.stripe_subscription_id = subscription_id
        sub.stripe_customer_id = customer_id
        sub.stripe_price_id = price_id
        sub.status = SubscriptionStatus.ACTIVE
        sub.current_period_start = period_start
        sub.current_period_end = period_end
        sub.cancelled_at = None
    else:
        db.add(Subscription(
            user_id=user.id,
            stripe_subscription_id=subscription_id,
            stripe_customer_id=customer_id,
            stripe_price_id=price_id,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=period_start,
            current_period_end=period_end,
        ))

    # Atualiza plano APÓS garantir que a subscription foi persistida
    user.plan = plan
    user.teacher_student_slots = teacher_slots
    entitlement = f"teacher_{teacher_slots}" if teacher_slots else plan.value
    logger.info("subscription_ativada", user_id=str(user.id), plan=entitlement)
    track_product_event(
        logger, "subscription_completed", user_id=str(user.id),
        account_type=user.user_type.value, plan=entitlement,
    )
    # Eventos Stripe não têm ordem garantida: invoice.paid pode chegar antes
    # da sessão. A confirmação de pagamento da sessão cobre esse caso.
    if session.get("payment_status") == "paid":
        amount = session.get("amount_total")
        await mark_paid_conversion(db, user.id, amount if session.get("currency") == "brl" else None)


async def _handle_subscription_updated(stripe_sub: dict, db: AsyncSession) -> None:
    """Assinatura atualizada: sincroniza status e período."""
    subscription_id = stripe_sub["id"]
    stripe_status = stripe_sub.get("status", "")
    new_status = _STRIPE_STATUS_MAP.get(stripe_status)

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_id
        )
    )
    sub = result.scalar_one_or_none()

    if not sub:
        logger.warning("webhook_subscription_nao_encontrada", subscription_id=subscription_id)
        return

    if new_status:
        sub.status = new_status

    sub.current_period_start = datetime.fromtimestamp(
        stripe_sub["current_period_start"], tz=timezone.utc
    )
    sub.current_period_end = datetime.fromtimestamp(
        stripe_sub["current_period_end"], tz=timezone.utc
    )

    # Sincroniza o plano do usuário com o status atual
    user_result = await db.execute(select(User).where(User.id == sub.user_id))
    user = user_result.scalar_one_or_none()

    if user:
        if stripe_status == "active":
            price_id = stripe_sub["items"]["data"][0]["price"]["id"]
            service = StripeService()
            user.plan = service.price_to_plan(price_id)
            user.teacher_student_slots = service.price_to_teacher_slots(price_id)
        elif stripe_status in ("canceled", "cancelled"):
            user.plan = UserPlan.FREE
            user.teacher_student_slots = 0

    logger.info("subscription_atualizada", subscription_id=subscription_id, status=stripe_status)


async def _handle_subscription_deleted(stripe_sub: dict, db: AsyncSession) -> None:
    """Assinatura cancelada: rebaixa o usuário para Free."""
    subscription_id = stripe_sub["id"]

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_id
        )
    )
    sub = result.scalar_one_or_none()

    if not sub:
        return

    sub.status = SubscriptionStatus.CANCELLED
    sub.cancelled_at = datetime.now(timezone.utc)

    user_result = await db.execute(select(User).where(User.id == sub.user_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.plan = UserPlan.FREE
        user.teacher_student_slots = 0
        track_product_event(
            logger, "subscription_cancelled", user_id=str(user.id),
            account_type=user.user_type.value, plan="free",
        )

    logger.info("subscription_cancelada", subscription_id=subscription_id, user_id=str(sub.user_id))


async def _handle_payment_failed(invoice: dict, db: AsyncSession) -> None:
    """Cobrança recorrente falhou: marca a assinatura como past_due."""
    subscription_id = invoice.get("subscription")
    if not subscription_id:
        return

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_id
        )
    )
    sub = result.scalar_one_or_none()

    if sub:
        sub.status = SubscriptionStatus.PAST_DUE
        logger.warning("pagamento_falhou", subscription_id=subscription_id, user_id=str(sub.user_id))


async def _handle_invoice_paid(invoice: dict, db: AsyncSession) -> None:
    """Só reconhece conversão após uma fatura de assinatura paga."""
    if invoice.get("amount_paid", 0) <= 0 or not invoice.get("subscription"):
        return
    result = await db.execute(select(Subscription).where(
        Subscription.stripe_subscription_id == invoice["subscription"]
    ))
    subscription = result.scalar_one_or_none()
    if subscription:
        await mark_paid_conversion(
            db, subscription.user_id,
            invoice["amount_paid"] if invoice.get("currency") == "brl" else None,
        )
