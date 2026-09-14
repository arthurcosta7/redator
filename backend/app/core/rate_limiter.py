"""
rate_limiter.py — Controle de taxa de requisições com Redis

Protege contra:
- Brute force em login (muitas tentativas de senha)
- Abuso da API (muitas requisições em pouco tempo)
- Excesso de uso de IA (custo elevado por requisição)
- Violação dos créditos mensais de correção e simulado

Estratégia: Sliding Window Counter com Redis
- Mais preciso que Fixed Window
- Resiliente a "border attacks" (atacar exatamente na virada do minuto)
"""
import secrets
import time
from datetime import UTC, datetime, timedelta
from typing import Any

import redis.asyncio as redis

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


_SLIDING_WINDOW_SCRIPT = """
local key = KEYS[1]
local window_start = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local member = ARGV[3]
local maximum = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
local count = redis.call('ZCARD', key)
if count >= maximum then
    return {0, count}
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttl)
return {1, count + 1}
"""

_MONTHLY_CREDIT_SCRIPT = """
local period = redis.call('HGET', KEYS[1], 'period')
local plan = redis.call('HGET', KEYS[1], 'plan')
local base_limit = tonumber(ARGV[3])
local rollover_cap = tonumber(ARGV[4])
local should_reserve = tonumber(ARGV[6])

if period ~= ARGV[1] or plan ~= ARGV[2] then
    local carry = 0
    if period == ARGV[7] and plan == ARGV[2] and rollover_cap > 0 then
        local old_limit = tonumber(redis.call('HGET', KEYS[1], 'limit') or '0')
        local old_used = tonumber(redis.call('HGET', KEYS[1], 'used') or '0')
        carry = math.min(math.max(old_limit - old_used, 0), rollover_cap)
    end
    redis.call('HSET', KEYS[1],
        'period', ARGV[1], 'plan', ARGV[2], 'used', 0,
        'limit', base_limit + carry, 'rollover', carry)
end

local used = tonumber(redis.call('HGET', KEYS[1], 'used') or '0')
local maximum = tonumber(redis.call('HGET', KEYS[1], 'limit') or base_limit)
local rollover = tonumber(redis.call('HGET', KEYS[1], 'rollover') or '0')
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[5]))
if should_reserve == 1 then
    if used >= maximum then return {0, used, maximum, rollover} end
    used = redis.call('HINCRBY', KEYS[1], 'used', 1)
end
return {1, used, maximum, rollover}
"""

_RELEASE_MONTHLY_SCRIPT = """
if redis.call('HGET', KEYS[1], 'period') ~= ARGV[1] then return 0 end
local current = tonumber(redis.call('HGET', KEYS[1], 'used') or '0')
if current <= 0 then return 0 end
return redis.call('HINCRBY', KEYS[1], 'used', -1)
"""


class RateLimiter:
    """
    Rate limiter usando Redis com algoritmo Sliding Window.

    Exemplo de uso:
        limiter = RateLimiter(redis_client)

        # Verifica se o IP pode fazer login (5 tentativas por 15 min)
        allowed = await limiter.check("login", ip_address, max_requests=5, window_seconds=900)
        if not allowed:
            raise HTTPException(429, "Muitas tentativas. Aguarde 15 minutos.")
    """

    def __init__(self, redis_client: Any) -> None:
        self.redis = redis_client

    # Ações de autenticação — falham fechadas se Redis cair (segurança > disponibilidade)
    _FAIL_CLOSED_ACTIONS = frozenset({
        "login", "registration", "password_reset", "password_reset_confirmation",
        "resend_verification", "essay_submission", "theme_generation",
        "simulado_generation",
    })

    async def check(
        self,
        action: str,
        identifier: str,
        max_requests: int,
        window_seconds: int,
    ) -> bool:
        """
        Verifica se a requisição está dentro do limite.

        Retorna True se permitida, False se bloqueada.

        Args:
            action: Nome da ação (ex: "login", "correction", "api")
            identifier: Quem está fazendo (IP ou user_id)
            max_requests: Máximo de requisições na janela
            window_seconds: Tamanho da janela em segundos
        """
        key = f"rate_limit:{action}:{identifier}"
        now = time.time()
        window_start = now - window_seconds

        try:
            member = f"{time.time_ns()}:{secrets.token_hex(8)}"
            allowed, current_count = await self.redis.eval(
                _SLIDING_WINDOW_SCRIPT,
                1,
                key,
                str(window_start),
                str(now),
                member,
                str(max_requests),
                str(window_seconds + 1),
            )

            if not allowed:
                logger.warning(
                    "rate_limit_exceeded",
                    action=action,
                    identifier=identifier[:8] + "...",  # Mascara parcialmente
                    current_count=current_count,
                    max_requests=max_requests,
                )
                return False

            return True

        except redis.RedisError as e:
            logger.error("rate_limiter_redis_error", action=action, error=str(e))
            # Endpoints de auth falham fechados: segurança > disponibilidade.
            # Outros endpoints falham abertos: evitar impacto a usuários legítimos.
            # Login usa janelas diferentes (login_15min/login_1hour). Tratar o
            # prefixo evita que uma indisponibilidade do Redis desative justamente
            # a proteção contra força bruta.
            if action in self._FAIL_CLOSED_ACTIONS or action.startswith("login_"):
                logger.warning("rate_limiter_fail_closed", action=action)
                return False
            return True

    async def get_remaining(
        self, action: str, identifier: str, window_seconds: int
    ) -> int:
        """Retorna quantas requisições ainda estão registradas na janela."""
        key = f"rate_limit:{action}:{identifier}"
        window_start = time.time() - window_seconds
        count = await self.redis.zcount(key, window_start, "+inf")
        return int(count)

    async def reset(self, action: str, identifier: str) -> None:
        """
        Reseta o contador de um identificador.

        Use com cuidado — geralmente só após ação administrativa.
        """
        key = f"rate_limit:{action}:{identifier}"
        await self.redis.delete(key)


# ─────────────────────────────────────────────────────────────────────────────
# Verificação de limite de plano
# ─────────────────────────────────────────────────────────────────────────────

def _credit_policy(plan: str, resource: str) -> tuple[int, int]:
    """Retorna (créditos-base, teto de acúmulo) para o recurso e plano."""
    if resource == "simulations":
        limits = {
            "free": settings.PLAN_FREE_MONTHLY_SIMULATIONS,
            "standard": settings.PLAN_STANDARD_MONTHLY_SIMULATIONS,
            "pro": settings.PLAN_PRO_MONTHLY_SIMULATIONS,
        }
        return int(limits.get(plan, limits["free"])), 0
    limits = {
        "free": settings.PLAN_FREE_MONTHLY_CORRECTIONS,
        "standard": settings.PLAN_STANDARD_MONTHLY_CORRECTIONS,
        "pro": settings.PLAN_PRO_MONTHLY_CORRECTIONS,
    }
    rollover = {"free": 0, "standard": 4, "pro": 10}
    return int(limits.get(plan, limits["free"])), rollover.get(plan, 0)


def _monthly_key(user_id: str, resource: str) -> str:
    return f"monthly_credits:{resource}:{user_id}"


def _month_period(now: datetime | None = None) -> str:
    current = now or datetime.now(UTC)
    return current.strftime("%Y-%m")


def _previous_month_period(now: datetime | None = None) -> str:
    """Identifica o mês imediatamente anterior, inclusive na virada do ano."""
    current = now or datetime.now(UTC)
    return (current.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")


def next_month_start(now: datetime | None = None) -> datetime:
    current = now or datetime.now(UTC)
    if current.month == 12:
        return current.replace(
            year=current.year + 1, month=1, day=1,
            hour=0, minute=0, second=0, microsecond=0,
        )
    return current.replace(
        month=current.month + 1, day=1,
        hour=0, minute=0, second=0, microsecond=0,
    )


async def _monthly_credit_operation(
    user_id: str,
    plan: str,
    redis_client: Any,
    *,
    resource: str,
    reserve: bool,
) -> tuple[bool, int, int, int]:
    base_limit, rollover_cap = _credit_policy(plan, resource)
    current_period = _month_period()
    try:
        allowed, used, limit, rollover = await redis_client.eval(
            _MONTHLY_CREDIT_SCRIPT,
            1,
            _monthly_key(user_id, resource),
            current_period,
            plan,
            str(base_limit),
            str(rollover_cap),
            str(370 * 24 * 60 * 60),
            "1" if reserve else "0",
            _previous_month_period(),
        )
        return bool(allowed), int(used), int(limit), int(rollover)
    except redis.RedisError as exc:
        logger.error(
            "redis_error_monthly_credits",
            resource=resource,
            user_id=user_id,
            error=str(exc),
        )
        # Créditos protegem custos externos; falhar fechado evita denial of wallet.
        return False, 0, base_limit, 0


async def check_monthly_credits(
    user_id: str,
    plan: str,
    redis_client: Any,
    *,
    resource: str = "corrections",
) -> tuple[bool, int, int, int]:
    return await _monthly_credit_operation(
        user_id, plan, redis_client, resource=resource, reserve=False
    )


async def reserve_monthly_credit(
    user_id: str,
    plan: str,
    redis_client: Any,
    *,
    resource: str = "corrections",
) -> tuple[bool, int, int, int]:
    """Reserva um crédito mensal de forma atômica."""
    return await _monthly_credit_operation(
        user_id, plan, redis_client, resource=resource, reserve=True
    )


async def release_monthly_credit(
    user_id: str,
    redis_client: Any,
    *,
    resource: str = "corrections",
) -> None:
    """Devolve uma reserva do mês corrente após uma falha operacional."""
    try:
        await redis_client.eval(
            _RELEASE_MONTHLY_SCRIPT,
            1,
            _monthly_key(user_id, resource),
            _month_period(),
        )
    except redis.RedisError as exc:
        logger.error(
            "redis_error_releasing_monthly_credit",
            resource=resource,
            user_id=user_id,
            error=str(exc),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Limites de autenticação (proteção contra brute force)
# ─────────────────────────────────────────────────────────────────────────────

async def check_login_attempts(
    ip_address: str,
    redis_client: redis.Redis,
) -> bool:
    """
    Bloqueia IPs que tentaram login muitas vezes.

    Limite: 5 tentativas a cada 15 minutos.
    Depois de 20 tentativas em 1 hora: bloqueio de 1 hora.
    """
    limiter = RateLimiter(redis_client)

    # Verificação leve: 5 tentativas por 15 min
    allowed_15min = await limiter.check(
        action="login_15min",
        identifier=ip_address,
        max_requests=5,
        window_seconds=900,  # 15 minutos
    )

    if not allowed_15min:
        return False

    # Verificação pesada: 20 tentativas por hora
    allowed_1hour = await limiter.check(
        action="login_1hour",
        identifier=ip_address,
        max_requests=20,
        window_seconds=3600,  # 1 hora
    )

    return allowed_1hour
