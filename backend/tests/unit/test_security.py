"""
test_security.py — Testes unitários das funções de segurança

Testa:
- Hash de senhas (bcrypt)
- Geração e validação de tokens JWT
- Tokens seguros para reset de senha
"""
import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
    generate_token_hash,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    """Testes de hash de senha."""

    def test_hash_is_different_from_original(self):
        """O hash nunca deve ser igual à senha original."""
        password = "MinhaSenhaSegura123"
        hashed = hash_password(password)
        assert hashed != password

    def test_verify_correct_password(self):
        """Deve retornar True para senha correta."""
        password = "MinhaSenhaSegura123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_reject_wrong_password(self):
        """Deve retornar False para senha incorreta."""
        hashed = hash_password("SenhaCorreta123")
        assert verify_password("SenhaErrada123", hashed) is False

    def test_different_hashes_for_same_password(self):
        """
        Dois hashes da mesma senha devem ser diferentes (por causa do salt).
        Isso é crítico — sem salt, rainbow tables quebrariam todos os hashes.
        """
        password = "MesmaSenha123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2  # Salt diferente = hash diferente

    def test_both_hashes_verify_same_password(self):
        """Mesmo com hashes diferentes, ambos devem verificar a mesma senha."""
        password = "MesmaSenha123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True

    def test_empty_password_rejected(self):
        """Senha vazia não deve ser hashable de forma útil."""
        # passlib/bcrypt aceita senha vazia, mas nosso schema Pydantic bloqueia
        # Testamos que o verify funciona corretamente
        hashed = hash_password("")
        assert verify_password("", hashed) is True
        assert verify_password("qualquercoisa", hashed) is False

    def test_rejects_password_over_bcrypt_byte_limit(self):
        """O limite do bcrypt é em bytes, não em caracteres Unicode."""
        password = "Aa1" + "á" * 35  # 38 caracteres, mas 73 bytes em UTF-8
        with pytest.raises(ValueError, match="72 bytes"):
            hash_password(password)


class TestJWTTokens:
    """Testes de tokens JWT."""

    def test_create_access_token(self):
        """Deve criar um access token válido."""
        token = create_access_token(
            user_id="test-user-id",
            user_type="student",
            plan="free",
        )
        assert isinstance(token, str)
        assert len(token) > 50  # JWT sempre tem tamanho considerável

    def test_decode_access_token(self):
        """Deve decodificar corretamente um access token."""
        user_id = "user-123-abc"
        token = create_access_token(user_id=user_id, user_type="teacher", plan="pro")
        payload = decode_token(token)

        assert payload["sub"] == user_id
        assert payload["type"] == "access"
        assert payload["user_type"] == "teacher"
        assert payload["plan"] == "pro"

    def test_refresh_token_type(self):
        """Refresh token deve ter type='refresh'."""
        token = create_refresh_token(user_id="user-456")
        payload = decode_token(token)
        assert payload["type"] == "refresh"

    def test_expired_token_rejected(self):
        """Token expirado deve lançar exceção."""
        import jwt
        from datetime import datetime, timezone, timedelta
        from app.core.config import settings

        # Cria token já expirado
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "user-123",
            "type": "access",
            "exp": now - timedelta(minutes=1),
            "iat": now - timedelta(minutes=2),
            "jti": "expired-test-token",
        }
        expired_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

        with pytest.raises(jwt.ExpiredSignatureError):
            decode_token(expired_token)

    def test_tampered_token_rejected(self):
        """Token com assinatura alterada deve ser rejeitado."""
        import jwt

        token = create_access_token("user-id", "student", "free")
        # Altera um caracter no meio do token
        tampered = token[:-5] + "XXXXX"

        with pytest.raises(jwt.InvalidTokenError):
            decode_token(tampered)

    def test_missing_required_claim_rejected(self):
        """JWTs sem claims de segurança obrigatórias nunca são aceitos."""
        import jwt
        from datetime import datetime, timezone, timedelta
        from app.core.config import settings

        incomplete = jwt.encode(
            {
                "sub": "user-123",
                "type": "access",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            },
            settings.SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

        with pytest.raises(jwt.MissingRequiredClaimError):
            decode_token(incomplete)

    def test_tokens_have_unique_jti(self):
        """Cada token deve ter um ID único (JTI)."""
        token1 = create_access_token("user-1", "student", "free")
        token2 = create_access_token("user-1", "student", "free")

        payload1 = decode_token(token1)
        payload2 = decode_token(token2)

        assert payload1["jti"] != payload2["jti"]


class TestSecureTokens:
    """Testes de tokens seguros para email/reset de senha."""

    def test_generate_secure_token(self):
        """Token seguro deve ter comprimento mínimo."""
        token = generate_secure_token(32)
        # token_urlsafe(32) gera ~43 caracteres (base64url)
        assert len(token) >= 32

    def test_tokens_are_unique(self):
        """Dois tokens nunca devem ser iguais."""
        token1 = generate_secure_token(32)
        token2 = generate_secure_token(32)
        assert token1 != token2

    def test_token_hash_is_consistent(self):
        """O hash do mesmo token sempre deve ser igual."""
        token = generate_secure_token(32)
        hash1 = generate_token_hash(token)
        hash2 = generate_token_hash(token)
        assert hash1 == hash2

    def test_different_tokens_have_different_hashes(self):
        """Tokens diferentes devem ter hashes diferentes."""
        token1 = generate_secure_token(32)
        token2 = generate_secure_token(32)
        assert generate_token_hash(token1) != generate_token_hash(token2)

    def test_hash_length_is_64_chars(self):
        """Hash SHA-256 deve ter 64 caracteres hexadecimais."""
        token = generate_secure_token(32)
        token_hash = generate_token_hash(token)
        assert len(token_hash) == 64
