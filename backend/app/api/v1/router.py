"""
router.py — Roteador principal da API v1

Agrega todos os roteadores de cada módulo.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, essays, users

api_router = APIRouter()

# Inclui todos os roteadores
api_router.include_router(auth.router)
api_router.include_router(essays.router)
api_router.include_router(users.router)
