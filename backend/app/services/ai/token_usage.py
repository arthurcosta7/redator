"""Normalização de usage e cálculo decimal de custo da OpenAI."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from app.core.config import settings

_MILLION = Decimal(1000000)


@dataclass(frozen=True)
class TokenUsage:
    input_tokens: int = 0
    cached_input_tokens: int = 0
    cache_write_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0

    @property
    def cache_hit_ratio(self) -> Decimal:
        if self.input_tokens <= 0:
            return Decimal(0)
        return Decimal(self.cached_input_tokens) / Decimal(self.input_tokens)

    @property
    def estimated_cost_usd(self) -> Decimal:
        # GPT-5.6 cobra escrita de cache separadamente quando a métrica é fornecida.
        uncached = max(
            self.input_tokens - self.cached_input_tokens - self.cache_write_tokens,
            0,
        )
        input_cost = Decimal(uncached) / _MILLION * settings.OPENAI_INPUT_PRICE_PER_MILLION
        cached_cost = (
            Decimal(self.cached_input_tokens)
            / _MILLION
            * settings.OPENAI_CACHED_INPUT_PRICE_PER_MILLION
        )
        cache_write_cost = (
            Decimal(self.cache_write_tokens)
            / _MILLION
            * settings.OPENAI_INPUT_PRICE_PER_MILLION
            * settings.OPENAI_CACHE_WRITE_MULTIPLIER
        )
        output_cost = (
            Decimal(self.output_tokens) / _MILLION * settings.OPENAI_OUTPUT_PRICE_PER_MILLION
        )
        return input_cost + cached_cost + cache_write_cost + output_cost


def _read_extra(details: Any, field: str) -> int:
    value = getattr(details, field, None)
    if value is None:
        model_extra = getattr(details, "model_extra", None) or {}
        value = model_extra.get(field, 0)
    return max(int(value or 0), 0)


def normalize_token_usage(usage: Any | None) -> TokenUsage:
    """Aceita objetos da SDK atual e permanece funcional em cache miss."""
    if usage is None:
        return TokenUsage()

    input_tokens = max(int(getattr(usage, "input_tokens", 0) or 0), 0)
    output_tokens = max(int(getattr(usage, "output_tokens", 0) or 0), 0)
    details = getattr(usage, "input_tokens_details", None)
    cached_tokens = min(_read_extra(details, "cached_tokens"), input_tokens)
    # Versões diferentes da SDK podem expor cache_write_tokens no usage ou
    # dentro de input_tokens_details; lemos ambos sem depender de um só formato.
    cache_write_tokens = _read_extra(usage, "cache_write_tokens")
    if cache_write_tokens == 0:
        cache_write_tokens = _read_extra(details, "cache_write_tokens")
    cache_write_tokens = min(cache_write_tokens, input_tokens - cached_tokens)
    total_tokens = max(
        int(getattr(usage, "total_tokens", input_tokens + output_tokens) or 0),
        0,
    )
    return TokenUsage(
        input_tokens=input_tokens,
        cached_input_tokens=cached_tokens,
        cache_write_tokens=cache_write_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
    )
