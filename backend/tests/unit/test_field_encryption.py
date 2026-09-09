"""Regressões da criptografia de campos sensíveis em repouso."""
import base64

import pytest
from sqlalchemy import text

from app.core.config import settings
from app.core.field_encryption import ENCRYPTED_PREFIX, decrypt_text, encrypt_text
from app.core.security import hash_password
from app.db.models.essay import Essay, EssayInputType, EssayStatus, EssayType
from app.db.models.user import User, UserType
from app.schemas.essay import SubmitEssayRequest
from app.schemas.tarefa import MotivatingText, TeacherCommentRequest


@pytest.fixture
def encryption_key(monkeypatch):
    key = base64.urlsafe_b64encode(bytes(range(32))).decode("ascii")
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", key)
    return key


def test_sensitive_text_is_authenticated_and_not_stored_in_plaintext(encryption_key):
    plaintext = "Texto pessoal do estudante"
    encrypted = encrypt_text(plaintext)

    assert encrypted.startswith(ENCRYPTED_PREFIX)
    assert plaintext not in encrypted
    assert decrypt_text(encrypted) == plaintext


def test_same_text_uses_random_nonce(encryption_key):
    assert encrypt_text("mesmo conteúdo") != encrypt_text("mesmo conteúdo")


def test_tampered_ciphertext_is_rejected(encryption_key):
    encrypted = encrypt_text("conteúdo íntegro")
    index = len(ENCRYPTED_PREFIX) + 10
    replacement = "A" if encrypted[index] != "A" else "B"
    tampered = encrypted[:index] + replacement + encrypted[index + 1:]

    with pytest.raises(ValueError, match="adulterado"):
        decrypt_text(tampered)


def test_legacy_plaintext_remains_readable_during_migration(encryption_key):
    assert decrypt_text("registro anterior à migração") == "registro anterior à migração"


@pytest.mark.asyncio
async def test_orm_encrypts_essay_columns_in_database(db_session, encryption_key):
    user = User(
        full_name="Aluno Teste",
        email="field-encryption@example.com",
        hashed_password=hash_password("SenhaSegura123!"),
        user_type=UserType.STUDENT,
    )
    db_session.add(user)
    await db_session.flush()
    essay = Essay(
        user_id=user.id,
        title="Título confidencial",
        content="Conteúdo pessoal da redação",
        theme="Tema confidencial",
        essay_type=EssayType.ENEM,
        input_type=EssayInputType.TEXT,
        status=EssayStatus.PENDING,
    )
    db_session.add(essay)
    await db_session.flush()
    essay_id = essay.id

    raw = (
        await db_session.execute(
            text("SELECT title, content, theme FROM essays"),
        )
    ).mappings().one()

    assert raw["title"].startswith(ENCRYPTED_PREFIX)
    assert raw["content"].startswith(ENCRYPTED_PREFIX)
    assert "Conteúdo pessoal" not in raw["content"]

    db_session.expire(essay)
    loaded = await db_session.get(Essay, essay_id)
    assert loaded is not None
    assert loaded.content == "Conteúdo pessoal da redação"


def test_essay_schema_strips_executable_markup():
    payload = SubmitEssayRequest(
        theme="Impactos <script>alert(1)</script> da tecnologia",
        title='<img src=x onerror="alert(1)">Título',
        content="Introdução <script>alert(document.cookie)</script> " + "palavra " * 20,
        essay_type="enem",
    )

    assert "<script" not in payload.content
    assert "<img" not in (payload.title or "")
    assert "<script" not in payload.theme


def test_assignment_and_teacher_comment_strip_executable_markup():
    motivating = MotivatingText(
        title="Referência <svg onload=alert(1)>",
        content="Texto <script>alert(1)</script> motivador",
    )
    comment = TeacherCommentRequest(comment="Revise <img src=x onerror=alert(1)> este trecho")

    assert "<svg" not in motivating.title
    assert "<script" not in motivating.content
    assert "<img" not in comment.comment
