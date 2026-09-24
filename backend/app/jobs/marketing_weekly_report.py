"""Resumo semanal por vendedor, enviado sem revelar dados de leads por email."""
from datetime import UTC, datetime, timedelta
from html import escape

from sqlalchemy import func, select

from app.core.config import settings
from app.core.logging import get_logger
from app.db.models.marketing import MarketingLead
from app.db.models.referral import ReferralAttribution, ReferralClick, ReferralLink
from app.db.models.user import AdminRole, User
from app.db.session import AsyncSessionLocal
from app.services.email.email_service import EmailService

logger = get_logger(__name__)


async def send_marketing_weekly_report(_ctx: dict) -> None:
    """Executado na segunda-feira pelo ARQ; cada pessoa recebe só seu escopo."""
    if not settings.RESEND_API_KEY:
        logger.info("marketing_report_skipped_email_not_configured")
        return
    since = datetime.now(UTC) - timedelta(days=7)
    async with AsyncSessionLocal() as db:
        team = (await db.execute(select(User).where(
            User.is_active.is_(True),
            User.admin_role.in_((AdminRole.SALES, AdminRole.MARKETING_MANAGER)),
        ))).scalars().all()
        sellers = [person for person in team if person.admin_role == AdminRole.SALES]
        summaries = []
        for seller in sellers:
            links = select(ReferralLink.id).where(ReferralLink.owner_id == seller.id)
            clicks = await db.scalar(select(func.count(ReferralClick.id)).where(
                ReferralClick.link_id.in_(links), ReferralClick.created_at >= since,
            )) or 0
            signups = await db.scalar(select(func.count(ReferralAttribution.id)).where(
                ReferralAttribution.link_id.in_(links), ReferralAttribution.created_at >= since,
            )) or 0
            paid = await db.scalar(select(func.count(ReferralAttribution.id)).where(
                ReferralAttribution.link_id.in_(links), ReferralAttribution.status == "valid",
                ReferralAttribution.converted_at >= since,
            )) or 0
            new_leads = await db.scalar(select(func.count(MarketingLead.id)).where(
                MarketingLead.owner_id == seller.id, MarketingLead.created_at >= since,
            )) or 0
            lead_rows = (await db.execute(select(MarketingLead.status, func.count(MarketingLead.id))
                                          .where(MarketingLead.owner_id == seller.id)
                                          .group_by(MarketingLead.status))).all()
            summaries.append((seller, clicks, signups, paid, new_leads, dict(lead_rows)))

        for recipient in team:
            rows = summaries if recipient.admin_role == AdminRole.MARKETING_MANAGER else [
                item for item in summaries if item[0].id == recipient.id
            ]
            table_rows = "".join(
                f"<tr><td>{escape(seller.full_name)}</td><td>{clicks}</td><td>{signups}</td>"
                f"<td>{paid}</td><td>{(signups / clicks * 100 if clicks else 0):.1f}%</td>"
                f"<td>{new_leads}</td>"
                f"<td>{escape(', '.join(f'{key}: {value}' for key, value in stages.items()))}</td></tr>"
                for seller, clicks, signups, paid, new_leads, stages in rows
            ) or "<tr><td colspan='7'>Sem atividade nesta semana.</td></tr>"
            html = (
                "<h1>Resumo semanal de marketing</h1>"
                "<p>Últimos 7 dias (UTC). Conversões = assinatura paga e indicação válida. "
                "Cliques podem incluir visitas repetidas.</p>"
                "<table border='1' cellpadding='8'><thead><tr><th>Vendedor</th><th>Cliques</th>"
                "<th>Cadastros</th><th>Pagantes</th><th>Cadastros/cliques</th>"
                "<th>Leads novos</th><th>Status atual dos leads</th></tr></thead>"
                f"<tbody>{table_rows}</tbody></table>"
            )
            try:
                await EmailService()._send(recipient.email, "Resumo semanal de marketing — Redator", html)
            except Exception as exc:  # noqa: BLE001 - erro externo de transporte não interrompe os demais emails
                logger.error("marketing_report_email_failed", user_id=str(recipient.id), error_type=type(exc).__name__)
        logger.info("marketing_report_finished", recipient_count=len(team))
