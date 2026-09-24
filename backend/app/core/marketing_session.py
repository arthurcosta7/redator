"""Expiração por inatividade da área comercial, vinculada ao refresh token."""
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, Request
from redis.exceptions import RedisError

from app.core.dependencies import get_redis, require_admin_role
from app.core.security import decode_token, generate_token_hash
from app.db.models.user import AdminRole, User

_IDLE_SECONDS = 30 * 60


def marketing_session_key(refresh_token: str) -> str:
    return f"marketing_idle:{generate_token_hash(refresh_token)}"


async def require_marketing_actor(
    request: Request,
    actor: Annotated[User, Depends(require_admin_role(
        "sales", "marketing_manager", "admin", "superadmin"
    ))],
    redis: Annotated[Any, Depends(get_redis)],
) -> User:
    if actor.admin_role in (AdminRole.ADMIN, AdminRole.SUPERADMIN):
        return actor
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "Sessão comercial expirada. Entre novamente.")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh" or payload.get("sub") != str(actor.id):
            raise ValueError("invalid marketing session")
        owner = await redis.getex(marketing_session_key(token), ex=_IDLE_SECONDS)
    except (jwt.InvalidTokenError, RedisError, OSError, TimeoutError, TypeError, ValueError):
        raise HTTPException(401, "Sessão comercial expirada. Entre novamente.")
    if owner != str(actor.id):
        raise HTTPException(401, "Sessão comercial expirada. Entre novamente.")
    return actor
