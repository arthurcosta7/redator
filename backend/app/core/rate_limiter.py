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
import time
from typing import Optional

import redis.asyncio as redis

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


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

    def __init__(self, redis_client: redis.Redis) -> None:
        self.redis = redis_client

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
            pipe = self.redis.pipeline()

            # Remove entradas antigas (fora da janela deslizante)
            await pipe.zremrangebyscore(key, 0, window_start)

            # Conta requisições na janela atual
            await pipe.zcard(key)

            # Adiciona a requisição atual
            await pipe.zadd(key, {str(now): now})

            # Define expiração (limpeza automática no Redis)
            await pipe.expire(key, window_seconds + 1)

            results = await pipe.execute()
            current_count = results[1]  # Resultado do zcard

            if current_count >= max_requests:
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
            # Se o Redis falhar, permite a requisição (fail-open para não bloquear usuários)
            # Em produção, monitore este erro — pode indicar problema no Redis
            logger.error("rate_limiter_redis_error", error=str(e))
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

async def check_daily_correction_limit(
    user_id: str,
    plan: str,
    redis_client: redis.Redis,
) -> tuple[bool, int, int]:
    """
    Verifica se o usuário pode fazer uma nova correção hoje.

    Retorna:
        (permitido: bool, usado_hoje: int, limite_diario: int)

    A chave expira à meia-noite (início do próximo dia).
    """
    from datetime import date

    # Limite por plano
    limits = {
        "free": settings.PLAN_FREE_DAILY_CORRECTIONS,
        "standard": settings.PLAN_STANDARD_DAILY_CORRECTIONS,
        "pro": settings.PLAN_PRO_DAILY_CORRECTIONS,
    }
    daily_limit = limits.get(plan, 1)

    # Chave única por usuário por dia
    today = date.today().isoformat()
    key = f"corrections:{user_id}:{today}"

    try:
        count = await redis_client.get(key)
        used_today = int(count) if count else 0

        if used_today >= daily_limit:
            return False, used_today, daily_limit

        return True, used_today, daily_limit

    except redis.RedisError:
        logger.error("redis_error_checking_correction_limit", user_id=user_id)
        # Fail-open: permite a correção se o Redis falhar
        return True, 0, daily_limit


async def increment_daily_correction_count(
    user_id: str,
    redis_client: redis.Redis,
) -> None:
    """
    Incrementa o contador de correções do dia.
    Chamado DEPOIS que a correção é gerada com sucesso.
    """
    from datetime import date, datetime, timedelta

    today = date.today().isoformat()
    key = f"corrections:{user_id}:{today}"

    # Calcula segundos até meia-noite (para expirar o contador no dia seguinte)
    now = datetime.now()
    midnight = datetime(now.year, now.month, now.day) + timedelta(days=1)
    seconds_until_midnight = int((midnight - now).total_seconds()) + 1

    try:
        pipe = redis_client.pipeline()
        await pipe.incr(key)
        await pipe.expire(key, seconds_until_midnight)
        await pipe.execute()
    except redis.RedisError as e:
        logger.error("redis_error_incrementing_correction", user_id=user_id, error=str(e))


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
