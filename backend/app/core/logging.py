"""
logging.py — Sistema de logging estruturado e seguro

Por que logging estruturado?
- Logs em JSON são fáceis de filtrar e buscar em ferramentas como Datadog, Grafana
- Nunca vaza dados sensíveis (senha, token, cartão de crédito)
- Facilita auditoria de segurança

Regras de segurança neste módulo:
1. Nunca logue senhas, tokens JWT, chaves de API
2. Nunca logue dados pessoais completos (CPF, cartão, endereço completo)
3. Sempre mascare emails (jo***@gmail.com) e IDs se necessário
"""
import hashlib
import hmac
import logging
import sys
from typing import Any

import structlog
from structlog.types import EventDict, WrappedLogger

from app.core.config import settings

# ─────────────────────────────────────────────────────────────────────────────
# Processadores de log — transformam os dados antes de escrever
# ─────────────────────────────────────────────────────────────────────────────

def remove_sensitive_data(
    logger: WrappedLogger, method_name: str, event_dict: EventDict
) -> EventDict:
    """
    Remove ou mascara dados sensíveis de todos os logs automaticamente.

    Esta é uma camada de proteção extra — o código já não deve logar
    dados sensíveis, mas esta função é o "safety net".
    """
    # Campos que NUNCA devem aparecer em logs
    forbidden_fields = {
        "password", "senha", "hashed_password",
        "token", "access_token", "refresh_token",
        "secret", "api_key", "stripe_key",
        "card_number", "cvv", "cpf", "authorization",
        "cookie", "set-cookie", "client_secret",
    }

    sensitive_suffixes = ("_password", "_token", "_secret", "_api_key")
    personal_fields = {
        "content", "essay_content", "theme", "title", "full_name", "display_name",
        "email", "to", "ip",
    }
    identifier_fields = {
        "user_id", "admin_id", "teacher_id", "executor_id", "target_user_id",
        "deleted_user_id", "invited_user_id", "identifier",
    }

    def pseudonymize(value: Any) -> str:
        return hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            str(value).encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:24]

    def redact(value: Any) -> Any:
        if isinstance(value, dict):
            clean: dict[Any, Any] = {}
            for key, item in value.items():
                normalized_key = str(key).lower()
                if (
                    normalized_key in forbidden_fields
                    or normalized_key.endswith(sensitive_suffixes)
                    or normalized_key in personal_fields
                    or normalized_key.endswith("_email")
                ):
                    clean[key] = "***REDACTED***"
                elif normalized_key in identifier_fields:
                    clean[key] = pseudonymize(item)
                else:
                    clean[key] = redact(item)
            return clean
        if isinstance(value, list):
            return [redact(item) for item in value]
        if isinstance(value, tuple):
            return tuple(redact(item) for item in value)
        return value

    event_dict = redact(event_dict)

    return event_dict


def add_environment(
    logger: WrappedLogger, method_name: str, event_dict: EventDict
) -> EventDict:
    """Adiciona o ambiente (dev/prod) a todos os logs para facilitar filtragem."""
    event_dict["environment"] = settings.ENVIRONMENT
    event_dict["app"] = settings.APP_NAME
    return event_dict


def setup_logging() -> None:
    """
    Configura o sistema de logging da aplicação.

    Em desenvolvimento: logs legíveis e coloridos no terminal
    Em produção: logs em JSON para ingestão em ferramentas de observabilidade
    """

    # Configuração dos processadores (transformações aplicadas a cada log)
    shared_processors: list[Any] = [
        # Adiciona timestamp em UTC
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        # Segurança: remove dados sensíveis
        remove_sensitive_data,
        # Adiciona contexto do ambiente
        add_environment,
    ]

    if settings.is_development:
        # Desenvolvimento: formato bonito e colorido
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True)
        ]
    else:
        # Produção: JSON puro para ferramentas de log
        processors = shared_processors + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configura o logging padrão do Python para usar structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if settings.DEBUG else logging.INFO,
    )

    # Silencia logs verbosos de bibliotecas externas
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.DEBUG else logging.WARNING
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """
    Retorna um logger configurado para um módulo específico.

    Uso:
        logger = get_logger(__name__)
        logger.info("usuario_criado", user_id=user.id, email=mask_email(user.email))
    """
    return structlog.get_logger(name)


def mask_email(email: str) -> str:
    """
    Mascara um email para logs: joao@gmail.com → jo***@gmail.com

    Use sempre que precisar logar um email para fins de diagnóstico.
    """
    parts = email.split("@")
    if len(parts) != 2:
        return "***@***.***"
    local = parts[0]
    domain = parts[1]
    # Mantém os primeiros 2 caracteres, mascara o resto
    masked_local = local[:2] + "***" if len(local) > 2 else "***"
    return f"{masked_local}@{domain}"
