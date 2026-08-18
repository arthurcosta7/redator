"""
simulado_service.py — Geração de simulados de redação com cache em pool

Estratégia de cache:
- Pool Redis por tipo: simulado_pool:enem, simulado_pool:vestibular
- Cada chamada do usuário consome um item do pool (RPOP)
- Quando pool < POOL_MIN_SIZE, dispara reabastecimento em background
- TTL do pool: 7 dias (os temas continuam relevantes por uma semana)
- Modelo usado: GPT-5.6 Luna (geração de conteúdo de alto volume)
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_POOL_MIN_SIZE = 3      # Reabastece quando pool cair abaixo deste tamanho
_POOL_TTL = 7 * 86400  # 7 dias em segundos
_REFILL_LOCK_TTL = 120
_RELEASE_LOCK_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
"""

_GENERATION_PROMPTS = {
    "enem": """Crie 5 propostas de redação no estilo ENEM em português brasileiro. As propostas devem ser realistas, atuais e variadas.

Retorne APENAS um JSON array válido com 5 objetos neste formato exato:
[
  {
    "theme": "Tema em até 10 palavras",
    "prompt": "Texto completo da proposta como no ENEM real: 2 parágrafos de contextualização seguidos do comando 'A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija um texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa sobre...'",
    "motivating_texts": [
      "Texto motivador 1 com no máximo 120 palavras. Pode ser trecho de artigo, dado estatístico ou citação.",
      "Texto motivador 2 com no máximo 120 palavras.",
      "Texto motivador 3 com no máximo 100 palavras — dado ou citação de apoio."
    ],
    "time_suggested_minutes": 60
  }
]

Os 5 temas devem ser distintos e cobrir áreas variadas: tecnologia/sociedade, saúde pública, educação, meio ambiente, direitos e cidadania.""",

    "vestibular": """Crie 5 propostas de redação no estilo vestibular universitário brasileiro (FUVEST/UNICAMP/UNESP) em português brasileiro. Propostas devem ser intelectualmente desafiadoras.

Retorne APENAS um JSON array válido com 5 objetos neste formato exato:
[
  {
    "theme": "Tema em até 10 palavras",
    "prompt": "Proposta completa com 1-2 parágrafos de contextualização e instrução clara para o estudante.",
    "motivating_texts": [
      "Texto motivador 1 com no máximo 100 palavras.",
      "Texto motivador 2 com no máximo 100 palavras."
    ],
    "time_suggested_minutes": 45
  }
]

Os 5 temas devem ser distintos: literatura e sociedade, filosofia prática, ciência e ética, política e democracia, cultura e identidade.""",
}


class SimuladoService:
    def __init__(self, client: AsyncOpenAI | None = None) -> None:
        self.client = client or AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.OPENAI_TIMEOUT_SECONDS,
            max_retries=settings.OPENAI_MAX_RETRIES,
        )

    async def get_simulado(self, essay_type: str, redis_client: Any) -> dict[str, Any]:
        """
        Retorna um simulado do pool Redis.
        Se o pool estiver vazio, gera um lote agora.
        Se estiver baixo, reabastece em background.
        """
        pool_key = f"simulado_pool:{essay_type}"

        raw = await redis_client.rpop(pool_key)

        if raw:
            pool_size = await redis_client.llen(pool_key)
            if pool_size < _POOL_MIN_SIZE:
                # Reabastece em background sem bloquear a resposta
                asyncio.create_task(self._refill_pool(essay_type, redis_client))
            cached: dict[str, Any] = json.loads(raw)
            return cached

        # Pool vazio — somente um processo pode gerar o lote. Os demais aguardam
        # brevemente por um item, evitando uma rajada de chamadas pagas à IA.
        logger.info("simulado_pool_vazio", essay_type=essay_type)
        lock_key = f"simulado_refill_lock:{essay_type}"
        lock_token = str(uuid.uuid4())
        acquired = await redis_client.set(
            lock_key,
            lock_token,
            nx=True,
            ex=_REFILL_LOCK_TTL,
        )
        if not acquired:
            for _ in range(25):
                await asyncio.sleep(0.2)
                raw = await redis_client.rpop(pool_key)
                if raw:
                    generated: dict[str, Any] = json.loads(raw)
                    return generated
            raise ValueError("Geração em andamento. Tente novamente em alguns segundos.")

        try:
            simulados = await self._generate_batch(essay_type)

            if not simulados:
                raise ValueError("Não foi possível gerar simulado. Tente novamente.")

            # Adiciona os demais ao pool para os próximos usuários
            for s in simulados[1:]:
                await redis_client.lpush(pool_key, json.dumps(s, ensure_ascii=False))
            await redis_client.expire(pool_key, _POOL_TTL)
            return simulados[0]
        finally:
            await self._release_lock(redis_client, lock_key, lock_token)

    async def _refill_pool(self, essay_type: str, redis_client: Any) -> None:
        """Reabastece o pool em segundo plano. Nunca lança exceção."""
        lock_key = f"simulado_refill_lock:{essay_type}"
        lock_token = str(uuid.uuid4())
        try:
            acquired = await redis_client.set(
                lock_key,
                lock_token,
                nx=True,
                ex=_REFILL_LOCK_TTL,
            )
            if not acquired:
                return
            pool_key = f"simulado_pool:{essay_type}"
            if await redis_client.llen(pool_key) >= _POOL_MIN_SIZE:
                return
            simulados = await self._generate_batch(essay_type)
            for s in simulados:
                await redis_client.lpush(pool_key, json.dumps(s, ensure_ascii=False))
            await redis_client.expire(pool_key, _POOL_TTL)
            logger.info("simulado_pool_reabastecido", essay_type=essay_type, added=len(simulados))
        except Exception as e:
            logger.error("erro_refill_simulado_pool", essay_type=essay_type, error=str(e))
        finally:
            await self._release_lock(redis_client, lock_key, lock_token)

    @staticmethod
    async def _release_lock(redis_client: Any, lock_key: str, lock_token: str) -> None:
        try:
            await redis_client.eval(_RELEASE_LOCK_SCRIPT, 1, lock_key, lock_token)
        except Exception as exc:
            logger.error("erro_liberando_lock_simulado", error_type=type(exc).__name__)

    async def _generate_batch(self, essay_type: str) -> list[dict[str, Any]]:
        """Gera 5 simulados via GPT-5.6 Luna e retorna como lista."""
        prompt = _GENERATION_PROMPTS.get(essay_type, _GENERATION_PROMPTS["enem"])

        response = await self.client.responses.create(
            model=settings.OPENAI_FREE_MODEL,
            max_output_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
            reasoning={"effort": "none"},
            store=False,
            input=[{"role": "user", "content": prompt}],
        )

        if response.status == "incomplete":
            raise ValueError("Resposta da IA incompleta")

        text = response.output_text.strip()

        # Remove markdown code block se presente
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        simulados: list[dict[str, Any]] = json.loads(text)

        # Adiciona metadados
        now = datetime.now(timezone.utc).isoformat()
        for s in simulados:
            s["id"] = str(uuid.uuid4())
            s["essay_type"] = essay_type
            s["generated_at"] = now

        logger.info("simulados_gerados", essay_type=essay_type, count=len(simulados))
        return simulados
