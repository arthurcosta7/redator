"""
router.py — Roteador principal da API v1

Agrega todos os roteadores de cada módulo.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import appeals, admin, auth, essays, insights, marketing, professor, referrals, simulados, stripe, users

api_router = APIRouter()

# Inclui todos os roteadores
api_router.include_router(auth.router)
api_router.include_router(essays.router)
api_router.include_router(appeals.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(referrals.router)
api_router.include_router(marketing.router)
api_router.include_router(professor.router)
api_router.include_router(stripe.router)
api_router.include_router(insights.router)
api_router.include_router(simulados.router)
