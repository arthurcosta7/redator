"""
dependencies.py — Dependências injetadas pelo FastAPI

O sistema de injeção de dependência do FastAPI permite reutilizar
código de forma limpa e testável. Aqui ficam as dependências principais:
- Sessão do banco de dados
- Usuário atual autenticado
- Cliente Redis
- Verificação de plano
"""
from typing import TYPE_CHECKING, Annotated, AsyncGenerator
from uuid import UUID

import jwt
import redis.asyncio as redis
from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import decode_token
from app.db.session import AsyncSessionLocal

if TYPE_CHECKING:
    from app.db.models.user import User

logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Sessão do banco de dados
# ─────────────────────────────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Fornece uma sessão assíncrona do banco de dados.

    Uso no endpoint:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...

    A sessão é fechada automaticamente ao final da requisição,
    mesmo se ocorrer um erro (graças ao try/finally).
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ─────────────────────────────────────────────────────────────────────────────
# Cliente Redis
# ─────────────────────────────────────────────────────────────────────────────

_redis_client: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    """
    Retorna o cliente Redis singleton.

    Redis é usado para:
    - Rate limiting (controle de requisições)
    - Contagem de correções diárias
    - Cache de respostas da IA (futuro)
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            socket_timeout=settings.REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_connect_timeout=settings.REDIS_CONNECT_TIMEOUT_SECONDS,
            socket_keepalive=True,
            health_check_interval=30,
        )
    return _redis_client


async def close_redis() -> None:
    """Fecha o pool Redis do processo durante o shutdown."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


# ─────────────────────────────────────────────────────────────────────────────
# Autenticação — Usuário atual
# ─────────────────────────────────────────────────────────────────────────────

async def get_current_user_id(
    access_token: Annotated[str | None, Cookie(alias="access_token")] = None,
    # Também aceita Bearer token no header (para clientes que não suportam cookies)
    request: Request = None,
) -> UUID:
    """
    Extrai e valida o access token, retornando o ID do usuário.

    O token é lido do cookie httpOnly (mais seguro que localStorage).
    Em caso de erro, lança 401 com mensagem genérica.

    SEGURANÇA: Mensagens de erro genéricas evitam vazar informação
    (não diz "token expirado" ou "token inválido" especificamente).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Autenticação necessária",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Tenta pegar o token do cookie primeiro, depois do header Authorization
    token = access_token

    if not token and request:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise credentials_exception

    try:
        payload = decode_token(token)

        user_id: str = payload.get("sub", "")
        token_type: str = payload.get("type", "")

        if not user_id or token_type != "access":
            raise credentials_exception

        try:
            return UUID(user_id)
        except (TypeError, ValueError, AttributeError):
            raise credentials_exception

    except jwt.ExpiredSignatureError:
        # Token expirado — cliente deve usar refresh token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )
    except jwt.InvalidTokenError:
        raise credentials_exception


async def get_current_user(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> "User":  # type: ignore
    """
    Busca o usuário completo no banco a partir do ID do token.

    Verifica também se o usuário está ativo (não suspenso/deletado).
    """
    from app.db.models.user import User
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada. Entre em contato com o suporte.",
        )

    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email não verificado. Verifique sua caixa de entrada.",
        )

    return user


async def get_current_token_data(
    access_token: Annotated[str | None, Cookie(alias="access_token")] = None,
    request: Request = None,
) -> dict:
    """
    Retorna o payload completo do token sem consultar o banco.

    Útil quando precisa dos dados do token (plano, tipo de usuário)
    sem overhead de consulta ao banco.
    """
    await get_current_user_id(access_token, request)

    token = access_token
    if not token and request:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    return decode_token(token)


# ─────────────────────────────────────────────────────────────────────────────
# Verificações de permissão
# ─────────────────────────────────────────────────────────────────────────────

def require_plan(*allowed_plans: str):
    """
    Decorator/dependency para exigir um plano específico.

    Uso:
        @router.post("/simulados")
        async def create_simulado(
            user = Depends(get_current_user),
            _: None = Depends(require_plan("standard", "pro"))
        ):
    """
    async def plan_checker(
        token_data: Annotated[dict, Depends(get_current_token_data)]
    ) -> None:
        user_plan = token_data.get("plan", "free")
        if user_plan not in allowed_plans:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Esta funcionalidade requer um plano superior. "
                       f"Faça upgrade para {' ou '.join(allowed_plans).upper()}.",
            )
    return plan_checker


def require_user_type(*allowed_types: str):
    """
    Exige um tipo específico de usuário (student ou teacher).

    Uso:
        @router.get("/turmas")
        async def list_turmas(
            _: None = Depends(require_user_type("teacher"))
        ):
    """
    async def type_checker(
        token_data: Annotated[dict, Depends(get_current_token_data)]
    ) -> None:
        user_type = token_data.get("user_type", "")
        if user_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso não permitido para este tipo de conta.",
            )
    return type_checker


# ─────────────────────────────────────────────────────────────────────────────
# Autenticação administrativa
# SEGURANÇA: A role do admin é verificada DIRETAMENTE no banco de dados
# a cada requisição. Nunca confiamos no token JWT para determinar acesso admin.
# Isso previne escalada de privilégios caso um token seja comprometido.
# ─────────────────────────────────────────────────────────────────────────────

async def get_current_admin(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> "User":  # type: ignore
    """
    Verifica que o usuário autenticado tem algum nível de acesso admin.

    SEGURANÇA: Consulta o banco a cada requisição — nunca usa o token.
    Se admin_role for removido do usuário, o acesso é cortado imediatamente
    na próxima requisição, sem precisar invalidar tokens.
    """
    from app.db.models.user import User

    result = await db.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária",
        )

    if not user.admin_role:
        # SEGURANÇA: Mensagem genérica — não revela que a rota existe
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso não autorizado.",
        )

    return user


def require_admin_role(*allowed_roles: str):
    """
    Dependency factory que exige um nível mínimo de acesso admin.

    Hierarquia: superadmin > admin > support > analyst

    Uso:
        @router.delete("/users/{id}")
        async def delete_user(
            admin = Depends(require_admin_role("superadmin"))
        ):

    SEGURANÇA: Sempre busca do banco, não do token.
    """
    async def role_checker(
        user_id: Annotated[UUID, Depends(get_current_user_id)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> "User":  # type: ignore
        from app.db.models.user import User
        from sqlalchemy import select

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Autenticação necessária",
            )

        if not user.admin_role or user.admin_role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso não autorizado.",
            )

        return user

    return role_checker
