"""
Exporta todos os modelos para que o Alembic os encontre automaticamente
ao gerar migrações.
"""
from app.db.models.user import User, UserType, UserPlan
from app.db.models.essay import Essay, EssayType, EssayStatus, EssayInputType
from app.db.models.correction import Correction
from app.db.models.subscription import Subscription, SubscriptionStatus
from app.db.models.refresh_token import RefreshToken

__all__ = [
    "User", "UserType", "UserPlan",
    "Essay", "EssayType", "EssayStatus", "EssayInputType",
    "Correction",
    "Subscription", "SubscriptionStatus",
    "RefreshToken",
]
