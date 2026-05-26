"""
security.py — Funções centrais de segurança

Responsável por:
- Hash e verificação de senhas (bcrypt)
- Criação e validação de tokens JWT
- Geração de tokens seguros para reset de senha, verificação de email, etc.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

# ─────────────────────────────────────────────────────────────────────────────
# SENHAS — bcrypt é o padrão seguro para hash de senhas
# ─────────────────────────────────────────────────────────────────────────────

# CryptContext gerencia o algoritmo de hash e permite migração futura
# bcrypt com custo 12 é o mínimo recomendado (2024)
# deprecated="auto" migra automaticamente hashes antigos quando o usuário loga
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,      # Custo computacional (maior = mais seguro, mais lento)
)


def hash_password(plain_password: str) -> str:
    """
    Gera o hash seguro de uma senha.

    Por que bcrypt?
    - Tem "salt" embutido (cada hash é único mesmo para a mesma senha)
    - Tem custo ajustável (fica mais lento se hardware melhorar)
    - É resistente a ataques de força bruta e rainbow tables
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica se uma senha corresponde ao hash armazenado.

    IMPORTANTE: Esta função usa comparação de tempo constante para
    prevenir ataques de timing (onde um atacante mede o tempo de resposta
    para descobrir informações sobre a senha).
    """
    return pwd_context.verify(plain_password, hashed_password)


# ─────────────────────────────────────────────────────────────────────────────
# JWT — Access Token e Refresh Token
# ─────────────────────────────────────────────────────────────────────────────

def create_access_token(user_id: str, user_type: str, plan: str) -> str:
    """
    Cria um JWT de acesso com vida curta (padrão: 15 minutos).

    O access token carrega informações básicas do usuário para não
    precisar consultar o banco em toda requisição.

    Dados no payload (NUNCA inclua dados sensíveis como senha):
    - sub: ID do usuário (subject — padrão JWT)
    - type: tipo de usuário (student/teacher)
    - plan: plano atual (free/standard/pro)
    - exp: expiração (automático)
    - iat: emitido em (automático)
    - jti: ID único do token (para possível revogação)
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": str(user_id),            # Subject: ID do usuário
        "type": "access",               # Tipo de token
        "user_type": user_type,         # student | teacher
        "plan": plan,                   # free | standard | pro
        "exp": expire,                  # Expiração
        "iat": now,                     # Emitido em
        "jti": secrets.token_hex(16),   # ID único do token
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """
    Cria um JWT de atualização com vida longa (padrão: 7 dias).

    O refresh token é usado SOMENTE para obter novos access tokens.
    Deve ser armazenado como httpOnly cookie (não acessível por JavaScript).
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "iat": now,
        "jti": secrets.token_hex(16),   # ID único — usado para revogar o token
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decodifica e valida um JWT.

    Lança exceções específicas:
    - jwt.ExpiredSignatureError: token expirado
    - jwt.InvalidTokenError: token inválido (assinatura errada, malformado, etc.)

    A validação automática inclui:
    - Assinatura criptográfica
    - Expiração (exp)
    - Emissão no passado (iat)
    """
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={
            "verify_exp": True,     # Sempre verifica expiração
            "verify_iat": True,     # Verifica se foi emitido no passado
        }
    )


# ─────────────────────────────────────────────────────────────────────────────
# TOKENS SEGUROS — Para reset de senha, verificação de email, etc.
# ─────────────────────────────────────────────────────────────────────────────

def generate_secure_token(length: int = 32) -> str:
    """
    Gera um token criptograficamente seguro para uso em links de email.

    Usa secrets.token_urlsafe que é seguro para URLs e usa
    o gerador de números aleatórios do sistema operacional (CSPRNG).

    Exemplos de uso:
    - Link de verificação de email
    - Link de reset de senha
    - Tokens de convite

    Por que NÃO usar uuid4() para isso?
    UUID v4 usa random(), que não é criptograficamente seguro.
    secrets.token_urlsafe() é projetado para segurança.
    """
    return secrets.token_urlsafe(length)


def generate_token_hash(token: str) -> str:
    """
    Gera um hash SHA-256 de um token para armazenar no banco.

    NUNCA armazene tokens de reset de senha em texto puro no banco —
    se o banco for comprometido, um atacante poderia usar os tokens.
    Armazene sempre o hash, como fazemos com senhas.
    """
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()
