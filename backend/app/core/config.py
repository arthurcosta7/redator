"""
config.py — Configurações centrais da aplicação

Usa pydantic-settings para ler variáveis de ambiente de forma segura.
Todas as configurações sensíveis DEVEM vir de variáveis de ambiente,
nunca hard-coded no código.
"""
from functools import lru_cache
import ipaddress
from typing import Literal
from urllib.parse import parse_qs, urlparse

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
    ACCESS_LOG_SUCCESS_SAMPLE_RATE: float = 0.05

    # ─── Segurança JWT ────────────────────────────────────────────
    # OBRIGATÓRIO: Gere com `python -c "import secrets; print(secrets.token_hex(64))"`
    SECRET_KEY: str
    JWT_ALGORITHM: Literal["HS256"] = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15       # Token de acesso: vida curta
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7          # Refresh token: vida maior

    # ─── CORS ─────────────────────────────────────────────────────
    # Lista de origens permitidas. Em produção: apenas seu domínio.
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # ─── Banco de Dados ───────────────────────────────────────────
    DATABASE_URL: str  # Ex: postgresql+asyncpg://user:pass@host/db
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 5
    DATABASE_POOL_TIMEOUT_SECONDS: int = 10
    DATABASE_POOL_RECYCLE_SECONDS: int = 1800

    # ─── Redis ────────────────────────────────────────────────────
    REDIS_URL: str  # Ex: redis://:senha@localhost:6379/0
    REDIS_MAX_CONNECTIONS: int = 50
    REDIS_SOCKET_TIMEOUT_SECONDS: int = 2
    REDIS_CONNECT_TIMEOUT_SECONDS: int = 2

    # ─── OpenAI API (IA) ─────────────────────────────────────────
    # OBRIGATÓRIO: Obtenha em platform.openai.com
    OPENAI_API_KEY: str = ""
    OPENAI_FREE_MODEL: str = "gpt-5.6-luna"
    OPENAI_PAID_MODEL: str = "gpt-5.4-mini"
    OPENAI_MAX_OUTPUT_TOKENS: int = 4096
    OPENAI_TIMEOUT_SECONDS: int = 90
    OPENAI_MAX_RETRIES: int = 2

    # ─── Processamento assíncrono ────────────────────────────────
    CORRECTION_WORKER_MAX_JOBS: int = 2
    CORRECTION_JOB_TIMEOUT_SECONDS: int = 180
    CORRECTION_JOB_MAX_TRIES: int = 3
    CORRECTION_JOB_EXPIRES_SECONDS: int = 3600

    # ─── Google Cloud Vision (OCR) ────────────────────────────────
    GOOGLE_APPLICATION_CREDENTIALS: str = ""       # Opcional, pode usar ADC
    OCR_TIMEOUT_SECONDS: int = 30
    OCR_MAX_CONCURRENCY: int = 2

    # ─── Stripe (Pagamentos) ──────────────────────────────────────
    # Opcional em desenvolvimento — funcionalidades de pagamento ficam inativas
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_STANDARD_MONTHLY: str = ""
    STRIPE_PRICE_STANDARD_QUARTERLY: str = ""
    STRIPE_PRICE_PRO_MONTHLY: str = ""
    STRIPE_PRICE_PRO_QUARTERLY: str = ""
    # Pacote de professor: R$11,99/mês por 10 alunos
    STRIPE_PRICE_TEACHER_PACKAGE: str = ""

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
    PLAN_PRO_DAILY_CORRECTIONS: int = 10

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

    @field_validator("ACCESS_LOG_SUCCESS_SAMPLE_RATE")
    @classmethod
    def validate_access_log_sample_rate(cls, v: float) -> float:
        if not 0 <= v <= 1:
            raise ValueError("ACCESS_LOG_SUCCESS_SAMPLE_RATE deve estar entre 0 e 1")
        return v

    @field_validator(
        "DATABASE_POOL_SIZE",
        "DATABASE_POOL_TIMEOUT_SECONDS",
        "DATABASE_POOL_RECYCLE_SECONDS",
        "REDIS_MAX_CONNECTIONS",
        "REDIS_SOCKET_TIMEOUT_SECONDS",
        "REDIS_CONNECT_TIMEOUT_SECONDS",
        "OPENAI_TIMEOUT_SECONDS",
        "CORRECTION_WORKER_MAX_JOBS",
        "CORRECTION_JOB_TIMEOUT_SECONDS",
        "CORRECTION_JOB_MAX_TRIES",
        "CORRECTION_JOB_EXPIRES_SECONDS",
        "OCR_TIMEOUT_SECONDS",
        "OCR_MAX_CONCURRENCY",
    )
    @classmethod
    def validate_positive_resource_limits(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Limites de recursos e timeouts devem ser maiores que zero")
        return v

    @model_validator(mode="after")
    def validate_stripe_price_ids(self) -> "Settings":
        """Garante que os Price IDs do Stripe têm o formato correto."""
        price_fields = [
            ("STRIPE_PRICE_STANDARD_MONTHLY", self.STRIPE_PRICE_STANDARD_MONTHLY),
            ("STRIPE_PRICE_STANDARD_QUARTERLY", self.STRIPE_PRICE_STANDARD_QUARTERLY),
            ("STRIPE_PRICE_PRO_MONTHLY", self.STRIPE_PRICE_PRO_MONTHLY),
            ("STRIPE_PRICE_PRO_QUARTERLY", self.STRIPE_PRICE_PRO_QUARTERLY),
        ]
        for field_name, value in price_fields:
            if value and not value.startswith("price_"):
                raise ValueError(
                    f"{field_name} deve começar com 'price_' (recebido: '{value[:12]}...'). "
                    "Verifique os IDs no dashboard do Stripe."
                )
        return self

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """Em produção, valida configurações críticas de segurança."""
        if self.ENVIRONMENT == "production":
            if self.DEBUG:
                raise ValueError("DEBUG não pode ser True em produção!")
            secret_lower = self.SECRET_KEY.lower()
            if (
                len(set(self.SECRET_KEY)) < 12
                or "sua_chave" in secret_lower
                or "change_me" in secret_lower
                or "changeme" in secret_lower
            ):
                raise ValueError(
                    "SECRET_KEY tem baixa entropia ou usa um valor de exemplo em produção!"
                )
            if not self.DATABASE_URL.startswith("postgresql+asyncpg://"):
                raise ValueError("DATABASE_URL deve usar PostgreSQL com asyncpg em produção!")

            database_url = urlparse(self.DATABASE_URL)
            database_query = parse_qs(database_url.query)
            database_tls = (
                database_query.get("ssl", database_query.get("sslmode", [""]))[0].lower()
            )
            database_is_internal = self._is_internal_host(database_url.hostname)
            if (
                not database_is_internal
                and database_tls not in {"require", "verify-ca", "verify-full", "true"}
            ):
                raise ValueError(
                    "DATABASE_URL deve exigir TLS em produção com ssl=require "
                    "ou sslmode=require!"
                )

            redis_url = urlparse(self.REDIS_URL)
            if redis_url.scheme not in {"redis", "rediss"}:
                raise ValueError("REDIS_URL deve usar redis:// ou rediss://!")
            if not self._is_internal_host(redis_url.hostname) and redis_url.scheme != "rediss":
                raise ValueError("REDIS_URL deve usar TLS (rediss://) em produção!")
            if not redis_url.password:
                raise ValueError("REDIS_URL deve incluir autenticação em produção!")

            if not self.ALLOWED_ORIGINS:
                raise ValueError("ALLOWED_ORIGINS deve conter ao menos uma origem em produção!")

            for origin in self.ALLOWED_ORIGINS:
                parsed = urlparse(origin)
                if (
                    origin == "*"
                    or "*" in origin
                    or parsed.scheme != "https"
                    or not parsed.hostname
                    or parsed.username is not None
                    or parsed.password is not None
                    or parsed.hostname in {"localhost", "127.0.0.1", "::1"}
                    or parsed.path != ""
                    or parsed.params
                    or parsed.query
                    or parsed.fragment
                ):
                    raise ValueError(
                        "Cada ALLOWED_ORIGINS deve ser uma origem HTTPS explícita, sem caminho, "
                        "localhost, wildcard, query ou fragmento em produção."
                    )

            frontend = urlparse(self.FRONTEND_URL)
            if (
                frontend.scheme != "https"
                or not frontend.hostname
                or frontend.username is not None
                or frontend.password is not None
                or frontend.path != ""
                or frontend.params
                or frontend.query
                or frontend.fragment
            ):
                raise ValueError(
                    "FRONTEND_URL deve ser uma origem HTTPS sem caminho, query ou fragmento "
                    "em produção!"
                )
        return self

    @staticmethod
    def _is_internal_host(hostname: str | None) -> bool:
        """Reconhece loopback, IP privado e nomes DNS internos de container."""
        if not hostname:
            return False
        if hostname.lower() == "localhost" or "." not in hostname:
            return True
        try:
            address = ipaddress.ip_address(hostname)
            return address.is_private or address.is_loopback
        except ValueError:
            return False

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
