"""
config.py — Configurações centrais da aplicação

Usa pydantic-settings para ler variáveis de ambiente de forma segura.
Todas as configurações sensíveis DEVEM vir de variáveis de ambiente,
nunca hard-coded no código.
"""
from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Configurações da aplicação.

    Pydantic valida automaticamente os tipos. Se uma variável obrigatória
    estiver faltando no .env, a aplicação NÃO vai subir — isso é intencional.
    Melhor falhar na inicialização do que rodar com config errada.
    """

    # ─── Aplicação ────────────────────────────────────────────────
    APP_NAME: str = "Redator"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: Literal["development", "staging", "production"] = "production"

    # ─── Segurança JWT ────────────────────────────────────────────
    # OBRIGATÓRIO: Gere com `python -c "import secrets; print(secrets.token_hex(64))"`
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15       # Token de acesso: vida curta
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7          # Refresh token: vida maior

    # ─── CORS ─────────────────────────────────────────────────────
    # Lista de origens permitidas. Em produção: apenas seu domínio.
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # ─── Banco de Dados ───────────────────────────────────────────
    DATABASE_URL: str  # Ex: postgresql+asyncpg://user:pass@host/db
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # ─── Redis ────────────────────────────────────────────────────
    REDIS_URL: str  # Ex: redis://:senha@localhost:6379/0

    # ─── Claude API (IA) ──────────────────────────────────────────
    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"     # Modelo padrão
    ANTHROPIC_MAX_TOKENS: int = 4096               # Máximo de tokens na resposta

    # ─── Google Cloud Vision (OCR) ────────────────────────────────
    GOOGLE_APPLICATION_CREDENTIALS: str = ""       # Opcional, pode usar ADC

    # ─── Stripe (Pagamentos) ──────────────────────────────────────
    # Opcional em desenvolvimento — funcionalidades de pagamento ficam inativas
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_STANDARD: str = ""
    STRIPE_PRICE_PRO: str = ""

    # ─── Email ────────────────────────────────────────────────────
    # Opcional em desenvolvimento — emails não são enviados se não configurado
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@redator.com.br"
    FROM_NAME: str = "Redator"

    # ─── URLs ─────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"

    # ─── Limites de uso por plano ─────────────────────────────────
    PLAN_FREE_DAILY_CORRECTIONS: int = 1
    PLAN_STANDARD_DAILY_CORRECTIONS: int = 3
    PLAN_PRO_DAILY_CORRECTIONS: int = 999999       # "Ilimitado"

    # ─── Upload de arquivos ───────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 5                      # Máximo 5MB por arquivo
    ALLOWED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp"]

    # ─── Configuração do Pydantic Settings ────────────────────────
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,    # Variáveis sensíveis a maiúsculas
        extra="ignore",         # Ignora variáveis extras no .env
    )

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Garante que a chave secreta tem comprimento mínimo seguro."""
        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY deve ter pelo menos 32 caracteres. "
                "Gere com: python -c \"import secrets; print(secrets.token_hex(64))\""
            )
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Garante que usa o driver assíncrono do PostgreSQL."""
        if "postgresql://" in v and "asyncpg" not in v:
            # Converte automaticamente para o driver assíncrono
            return v.replace("postgresql://", "postgresql+asyncpg://")
        return v

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """Em produção, valida configurações críticas de segurança."""
        if self.ENVIRONMENT == "production":
            if self.DEBUG:
                raise ValueError("DEBUG não pode ser True em produção!")
            if "localhost" in self.ALLOWED_ORIGINS[0]:
                raise ValueError(
                    "ALLOWED_ORIGINS não pode apontar para localhost em produção!"
                )
        return self

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


# @lru_cache garante que Settings() é criado uma única vez
# (singleton pattern — evita ler .env várias vezes)
@lru_cache
def get_settings() -> Settings:
    return Settings()


# Instância global de configurações
settings = get_settings()
