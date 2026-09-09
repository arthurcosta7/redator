"""
test_validators.py — Testes dos validadores de entrada

Testa que inputs maliciosos são rejeitados corretamente.
"""
import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterStudentRequest, ResetPasswordRequest


class TestPasswordValidation:
    """Testa as regras de senha."""

    def test_rejects_password_without_uppercase(self):
        with pytest.raises(ValidationError, match="maiúscula"):
            RegisterStudentRequest(
                full_name="João Silva",
                email="test@test.com",
                password="minuscula123",
            )

    def test_rejects_password_without_lowercase(self):
        with pytest.raises(ValidationError, match="minúscula"):
            RegisterStudentRequest(
                full_name="João Silva",
                email="test@test.com",
                password="MAIUSCULA123",
            )

    def test_rejects_password_without_number(self):
        with pytest.raises(ValidationError, match="número"):
            RegisterStudentRequest(
                full_name="João Silva",
                email="test@test.com",
                password="SemNumeroAqui",
            )

    def test_rejects_short_password(self):
        with pytest.raises(ValidationError):
            RegisterStudentRequest(
                full_name="João Silva",
                email="test@test.com",
                password="Ab1",  # Muito curta
            )

    def test_accepts_strong_password(self):
        """Senha forte deve ser aceita."""
        req = RegisterStudentRequest(
            full_name="João Silva",
            email="test@test.com",
            password="SenhaForte123",
        )
        assert req.password == "SenhaForte123"

    def test_rejects_unicode_password_over_bcrypt_byte_limit(self):
        with pytest.raises(ValidationError, match="72 bytes"):
            RegisterStudentRequest(
                full_name="João Silva",
                email="test@test.com",
                password="Aa1" + "á" * 35,
            )

    def test_rejects_oversized_reset_token(self):
        with pytest.raises(ValidationError):
            ResetPasswordRequest(
                token="x" * 257,
                new_password="SenhaForte123",
            )


class TestEmailValidation:
    """Testa validação de email."""

    def test_rejects_invalid_email(self):
        with pytest.raises(ValidationError):
            RegisterStudentRequest(
                full_name="João Silva",
                email="nao-e-um-email",
                password="SenhaForte123",
            )

    def test_rejects_email_without_domain(self):
        with pytest.raises(ValidationError):
            RegisterStudentRequest(
                full_name="João Silva",
                email="usuario@",
                password="SenhaForte123",
            )


class TestNameValidation:
    """Testa validação do nome."""

    def test_rejects_single_name(self):
        """Deve exigir nome e sobrenome."""
        with pytest.raises(ValidationError, match="nome completo"):
            RegisterStudentRequest(
                full_name="João",  # Só nome, sem sobrenome
                email="test@test.com",
                password="SenhaForte123",
            )

    def test_strips_extra_spaces(self):
        """Deve remover espaços extras do nome."""
        req = RegisterStudentRequest(
            full_name="  João   da   Silva  ",
            email="test@test.com",
            password="SenhaForte123",
        )
        assert req.full_name == "João da Silva"

    def test_rejects_empty_name(self):
        with pytest.raises(ValidationError):
            RegisterStudentRequest(
                full_name="",
                email="test@test.com",
                password="SenhaForte123",
            )


class TestFileValidation:
    """Testa validação de uploads de arquivo."""

    def test_rejects_empty_file(self):
        from fastapi import HTTPException

        from app.utils.file_validator import validate_image_file

        with pytest.raises(HTTPException) as exc_info:
            validate_image_file(b"", "foto.jpg", "image/jpeg")
        assert exc_info.value.status_code == 422

    def test_detects_jpeg_by_magic_bytes(self):
        """JPEG começa com FF D8 FF."""
        from app.utils.file_validator import _detect_image_type
        jpeg_header = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        assert _detect_image_type(jpeg_header) == "image/jpeg"

    def test_detects_png_by_magic_bytes(self):
        """PNG começa com 89 50 4E 47 0D 0A 1A 0A."""
        from app.utils.file_validator import _detect_image_type
        png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        assert _detect_image_type(png_header) == "image/png"

    def test_rejects_fake_jpeg_with_wrong_extension(self):
        """Arquivo executável renomeado como .jpg deve ser rejeitado."""
        from fastapi import HTTPException

        from app.utils.file_validator import validate_image_file

        # Simula um arquivo executável Windows (MZ header)
        fake_exe = b"MZ\x90\x00" + b"\x00" * 500

        with pytest.raises(HTTPException) as exc_info:
            validate_image_file(fake_exe, "foto.jpg", "image/jpeg")
        assert exc_info.value.status_code == 422

    def test_rejects_oversized_file(self):
        """Arquivo maior que o limite deve ser rejeitado."""
        from fastapi import HTTPException

        from app.utils.file_validator import validate_image_file

        # Cria JPEG falso mas grande demais
        jpeg_header = b"\xff\xd8\xff\xe0"
        huge_content = jpeg_header + b"\x00" * (6 * 1024 * 1024)  # 6MB

        with pytest.raises(HTTPException) as exc_info:
            validate_image_file(huge_content, "enorme.jpg", "image/jpeg")
        assert exc_info.value.status_code == 413

    @pytest.mark.parametrize(
        ("payload", "filename", "content_type"),
        [
            (b"\x89PNG\r\n\x1a\n" + b"<script>alert(1)</script>", "fake.png", "image/png"),
            (b"\xff\xd8\xff\xe0" + b"not-a-real-image", "fake.jpg", "image/jpeg"),
            (b"RIFF\x10\x00\x00\x00WEBP" + b"not-a-real-image", "fake.webp", "image/webp"),
        ],
    )
    def test_rejects_truncated_or_polyglot_image(self, payload, filename, content_type):
        from fastapi import HTTPException

        from app.utils.file_validator import validate_image_file

        with pytest.raises(HTTPException) as exc_info:
            validate_image_file(payload, filename, content_type)
        assert exc_info.value.status_code == 422

    def test_accepts_a_decodable_png(self):
        import io

        from PIL import Image

        from app.utils.file_validator import validate_image_file

        buffer = io.BytesIO()
        Image.new("RGB", (32, 32), color="white").save(buffer, format="PNG")
        validate_image_file(buffer.getvalue(), "redacao.png", "image/png")


class TestInjectionValidation:
    """Entradas maliciosas permanecem dados e não viram código executável."""

    def test_sql_payload_is_parameterized_by_sqlalchemy(self):
        from sqlalchemy import select

        from app.db.models.user import User

        payload = "x' OR 1=1; DROP TABLE users; --"
        statement = select(User).where(User.email == payload)
        compiled = statement.compile()

        assert payload not in str(compiled)
        assert payload in compiled.params.values()

    def test_xss_and_template_payloads_are_sanitized(self):
        from app.utils.text_sanitizer import sanitize_essay_text

        payload = '<script>alert("xss")</script> Texto {{7*7}} seguro'
        cleaned = sanitize_essay_text(payload)

        assert "<script" not in cleaned
        assert "{{7*7}}" not in cleaned
        assert "Texto" in cleaned
