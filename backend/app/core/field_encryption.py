"""Criptografia autenticada para campos sensíveis persistidos no banco."""
import base64
import json
import os
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import Text
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator

from app.core.config import settings

ENCRYPTED_PREFIX = "enc:v1:"
_AAD = b"redator:database-field:v1"


def decode_encryption_key(value: str) -> bytes:
    """Decodifica uma chave URL-safe Base64 e exige exatamente 256 bits."""
    try:
        key = base64.b64decode(value.encode("ascii"), altchars=b"-_", validate=True)
    except (ValueError, UnicodeEncodeError) as exc:
        raise ValueError("DATA_ENCRYPTION_KEY deve ser Base64 URL-safe válida") from exc
    if len(key) != 32:
        raise ValueError("DATA_ENCRYPTION_KEY deve representar exatamente 32 bytes")
    return key


def encrypt_text(value: str) -> str:
    """Criptografa com AES-256-GCM; mantém dados legados já criptografados."""
    if not value or value.startswith(ENCRYPTED_PREFIX):
        return value
    if not settings.DATA_ENCRYPTION_KEY:
        # Desenvolvimento pode operar sem chave; produção falha na validação de Settings.
        return value

    nonce = os.urandom(12)
    ciphertext = AESGCM(decode_encryption_key(settings.DATA_ENCRYPTION_KEY)).encrypt(
        nonce, value.encode("utf-8"), _AAD
    )
    payload = base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")
    return f"{ENCRYPTED_PREFIX}{payload}"


def decrypt_text(value: str) -> str:
    """Descriptografa valores v1 e aceita texto legado ainda não migrado."""
    if not value or not value.startswith(ENCRYPTED_PREFIX):
        return value
    if not settings.DATA_ENCRYPTION_KEY:
        raise RuntimeError("DATA_ENCRYPTION_KEY é necessária para ler dados criptografados")

    try:
        payload = base64.b64decode(
            value.removeprefix(ENCRYPTED_PREFIX).encode("ascii"),
            altchars=b"-_",
            validate=True,
        )
        plaintext = AESGCM(decode_encryption_key(settings.DATA_ENCRYPTION_KEY)).decrypt(
            payload[:12], payload[12:], _AAD
        )
    except (ValueError, InvalidTag) as exc:
        raise ValueError("Campo criptografado inválido ou adulterado") from exc
    return plaintext.decode("utf-8")


class EncryptedText(TypeDecorator[str]):
    """SQLAlchemy type que cifra antes do INSERT e decifra após o SELECT."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect: Dialect) -> str | None:
        return encrypt_text(value) if value is not None else None

    def process_result_value(self, value: str | None, dialect: Dialect) -> str | None:
        return decrypt_text(value) if value is not None else None


class EncryptedJSON(TypeDecorator[Any]):
    """Serializa JSON e o cifra como um único valor autenticado."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> str | None:
        if value is None:
            return None
        serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        return encrypt_text(serialized)

    def process_result_value(self, value: str | None, dialect: Dialect) -> Any:
        if value is None:
            return None
        return json.loads(decrypt_text(value))
