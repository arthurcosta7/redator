"""Eventos de produto próprios e sem conteúdo pessoal.

Somente nomes e propriedades previamente autorizados são enviados ao logger.
Textos de redação, nomes, emails, temas e identificadores de terceiros nunca são
aceitos por esta camada.
"""
import hashlib
import hmac
from typing import Any

from app.core.config import settings

ALLOWED_EVENTS = frozenset({
    "registration_started", "registration_completed", "first_essay_submitted",
    "second_essay_submitted", "first_correction_completed", "second_correction_completed",
    "credits_used", "credit_limit_exceeded", "plans_viewed", "checkout_started",
    "subscription_completed", "subscription_cancelled", "class_created",
    "invitation_sent", "student_activated", "assignment_created",
    "assignment_ai_generated", "assignment_essay_submitted", "teacher_report_viewed",
    "photo_ocr_extracted",
})
ALLOWED_PROPERTIES = frozenset({
    "account_type", "plan", "resource", "used", "limit", "essay_type",
    "sequence", "teacher_plan", "report_type", "word_count",
})


def track_product_event(
    logger: Any,
    event: str,
    *,
    user_id: str | None = None,
    **properties: Any,
) -> None:
    """Registra evento somente se nome/propriedades estiverem na lista segura."""
    if event not in ALLOWED_EVENTS:
        raise ValueError(f"Evento de produto não autorizado: {event}")
    safe = {
        key: value for key, value in properties.items()
        if key in ALLOWED_PROPERTIES and isinstance(value, (str, int, float, bool))
    }
    actor_id = None
    if user_id:
        actor_id = hmac.new(
            settings.SECRET_KEY.encode("utf-8"), user_id.encode("utf-8"), hashlib.sha256
        ).hexdigest()[:24]
    logger.info("product_event", product_event=event, actor_id=actor_id, **safe)
