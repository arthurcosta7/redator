"""Privacidade e contrato fechado dos eventos de produto."""
from unittest.mock import Mock

import pytest

from app.services.product_analytics import track_product_event


def test_product_event_pseudonymizes_actor_and_drops_personal_fields():
    logger = Mock()
    raw_user_id = "user-123"

    track_product_event(
        logger,
        "credits_used",
        user_id=raw_user_id,
        plan="free",
        resource="corrections",
        used=1,
        limit=4,
        email="aluno@example.com",
        essay_content="conteúdo privado",
    )

    _message, kwargs = logger.info.call_args.args[0], logger.info.call_args.kwargs
    assert kwargs["actor_id"] != raw_user_id
    assert len(kwargs["actor_id"]) == 24
    assert "email" not in kwargs
    assert "essay_content" not in kwargs


def test_product_event_rejects_unknown_name():
    with pytest.raises(ValueError, match="não autorizado"):
        track_product_event(Mock(), "arbitrary_client_event")
