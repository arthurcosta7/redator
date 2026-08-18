"""
rate_limiter.py — Controle de taxa de requisições com Redis

Protege contra:
- Brute force em login (muitas tentativas de senha)
- Abuso da API (muitas requisições em pouco tempo)
- Excesso de uso de IA (custo elevado por requisição)
- Violação dos limites de plano (Free: 1/dia, Standard: 3/dia, Pro: ilimitado)

Estratégia: Sliding Window Counter com Redis
- Mais preciso que Fixed Window
- Resiliente a "border attacks" (atacar exatamente na virada do minuto)
"""
import secrets
import time
from datetime import datetime, timedelta, timezone
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

_RESERVE_DAILY_SCRIPT = """
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local maximum = tonumber(ARGV[1])
if current >= maximum then
    return {0, current}
end
current = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return {1, current}
"""

_RELEASE_DAILY_SCRIPT = """
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current <= 1 then
    redis.call('DEL', KEYS[1])
    return 0
end
return redis.call('DECR', KEYS[1])
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

def _daily_limit(plan: str) -> int:
    return int({
        "free": settings.PLAN_FREE_DAILY_CORRECTIONS,
        "standard": settings.PLAN_STANDARD_DAILY_CORRECTIONS,
        "pro": settings.PLAN_PRO_DAILY_CORRECTIONS,
    }.get(plan, settings.PLAN_FREE_DAILY_CORRECTIONS))


def _daily_key(user_id: str) -> str:
    return f"corrections:{user_id}:{datetime.now(timezone.utc).date().isoformat()}"


def _seconds_until_midnight() -> int:
    now = datetime.now(timezone.utc)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((midnight - now).total_seconds()) + 1)


async def check_daily_correction_limit(
    user_id: str,
    plan: str,
    redis_client: Any,
) -> tuple[bool, int, int]:
    """
    Verifica se o usuário pode fazer uma nova correção hoje.

    Retorna:
        (permitido: bool, usado_hoje: int, limite_diario: int)

    A chave expira à meia-noite (início do próximo dia).
    """
    daily_limit = _daily_limit(plan)
    key = _daily_key(user_id)

    try:
        count = await redis_client.get(key)
        used_today = int(count) if count else 0

        if used_today >= daily_limit:
            return False, used_today, daily_limit

        return True, used_today, daily_limit

    except redis.RedisError:
        logger.error("redis_error_checking_correction_limit", user_id=user_id)
        # Correções geram custo externo: indisponibilidade do limitador não pode
        # virar consumo ilimitado (denial of wallet).
        return False, 0, daily_limit


async def reserve_daily_correction_slot(
    user_id: str,
    plan: str,
    redis_client: Any,
) -> tuple[bool, int, int]:
    """Reserva uma correção de forma atômica, sem corrida entre requisições."""
    daily_limit = _daily_limit(plan)
    try:
        allowed, used_today = await redis_client.eval(
            _RESERVE_DAILY_SCRIPT,
            1,
            _daily_key(user_id),
            str(daily_limit),
            str(_seconds_until_midnight()),
        )
        return bool(allowed), int(used_today), daily_limit
    except redis.RedisError as exc:
        logger.error("redis_error_reserving_correction", user_id=user_id, error=str(exc))
        return False, 0, daily_limit


async def release_daily_correction_slot(user_id: str, redis_client: Any) -> None:
    """Devolve uma reserva quando a correção não pôde ser enfileirada/concluída."""
    try:
        await redis_client.eval(_RELEASE_DAILY_SCRIPT, 1, _daily_key(user_id))
    except redis.RedisError as exc:
        logger.error("redis_error_releasing_correction", user_id=user_id, error=str(exc))


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
