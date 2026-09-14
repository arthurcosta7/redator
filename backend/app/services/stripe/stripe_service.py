"""
stripe_service.py — Serviço de integração com Stripe

Responsável por:
- Criar/recuperar Customer no Stripe
- Criar Checkout Sessions (Hosted Checkout)
- Criar Billing Portal Sessions
- Mapear price_id ↔ plano da aplicação
"""
import asyncio

import stripe

from app.core.config import settings
from app.core.logging import get_logger
from app.db.models.user import User, UserPlan

logger = get_logger(__name__)


class StripeService:

    def __init__(self) -> None:
        stripe.api_key = settings.STRIPE_SECRET_KEY

    # ─── Mapeamento plan/período ↔ price_id ──────────────────────

    def get_price_id(self, plan: str, period: str) -> str:
        """Retorna o Stripe Price ID para o plano e período informados."""
        mapping: dict[tuple[str, str], str] = {
            ("standard", "mensal"):     settings.STRIPE_PRICE_STANDARD_MONTHLY,
            ("pro", "mensal"):          settings.STRIPE_PRICE_PRO_MONTHLY,
            ("teacher_30", "mensal"):   settings.STRIPE_PRICE_TEACHER_30_MONTHLY,
            ("teacher_60", "mensal"):   settings.STRIPE_PRICE_TEACHER_60_MONTHLY,
            ("teacher_100", "mensal"):  settings.STRIPE_PRICE_TEACHER_100_MONTHLY,
        }
        price_id = mapping.get((plan.lower(), period.lower()))
        if not price_id:
            raise ValueError(f"Plano ou período inválido: {plan}/{period}")
        return price_id

    def price_to_plan(self, price_id: str) -> UserPlan:
        """Converte um Stripe Price ID no plano correspondente da aplicação."""
        standard_ids = {
            settings.STRIPE_PRICE_STANDARD_MONTHLY,
            settings.STRIPE_PRICE_STANDARD_QUARTERLY,
        }
        pro_ids = {
            settings.STRIPE_PRICE_PRO_MONTHLY,
            settings.STRIPE_PRICE_PRO_QUARTERLY,
        }
        if price_id in standard_ids:
            return UserPlan.STANDARD
        if price_id in pro_ids:
            return UserPlan.PRO
        return UserPlan.FREE

    def price_to_teacher_slots(self, price_id: str) -> int:
        """Converte o Price ID comercial na capacidade total da conta docente."""
        legacy_price = settings.STRIPE_PRICE_TEACHER_PACKAGE
        if legacy_price and price_id == legacy_price:
            # Assinaturas antigas recebem Professor 30 sem reduzir direitos.
            return 30
        return {
            settings.STRIPE_PRICE_TEACHER_30_MONTHLY: 30,
            settings.STRIPE_PRICE_TEACHER_60_MONTHLY: 60,
            settings.STRIPE_PRICE_TEACHER_100_MONTHLY: 100,
        }.get(price_id, 0)

    # ─── Operações Stripe ─────────────────────────────────────────

    async def get_or_create_customer(self, user: User) -> str:
        """Retorna o Stripe Customer ID do usuário, criando um se necessário."""
        if user.stripe_customer_id:
            return user.stripe_customer_id

        customer = await asyncio.to_thread(
            stripe.Customer.create,
            email=user.email,
            name=user.full_name,
            metadata={"user_id": str(user.id)},
        )
        logger.info("stripe_customer_criado", user_id=str(user.id))
        return customer.id

    async def create_checkout_session(
        self,
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
    ) -> str:
        """Cria uma Stripe Checkout Session e retorna a URL de redirecionamento."""
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            allow_promotion_codes=True,
        )
        return session.url

    async def create_portal_session(self, customer_id: str, return_url: str) -> str:
        """Cria uma Stripe Billing Portal Session para gerenciar a assinatura."""
        session = await asyncio.to_thread(
            stripe.billing_portal.Session.create,
            customer=customer_id,
            return_url=return_url,
        )
        return session.url

    async def retrieve_subscription(self, subscription_id: str) -> stripe.Subscription:
        """Recupera os detalhes de uma assinatura do Stripe."""
        return await asyncio.to_thread(stripe.Subscription.retrieve, subscription_id)
