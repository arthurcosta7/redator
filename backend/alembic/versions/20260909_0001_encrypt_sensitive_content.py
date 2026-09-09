"""encrypt essays, corrections and appeal content at rest

Revision ID: e4f6a8b0c219
Revises: c91f7a2d4e10
Create Date: 2026-09-09 00:01:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op
from app.core.field_encryption import decrypt_text, encrypt_text

revision: str = "e4f6a8b0c219"
down_revision: str | None = "c91f7a2d4e10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_SENSITIVE_COLUMNS = {
    "users": ("school_name", "discipline", "grade"),
    "turma_membros": ("display_name",),
    "tarefa_submissoes": ("teacher_comment",),
    "essays": ("title", "content", "theme"),
    "corrections": ("competencies", "highlights", "insights"),
    "correction_appeals": (
        "student_reason",
        "original_competencies",
        "original_highlights",
        "original_insights",
        "corrected_competencies",
        "reviewer_explanation",
    ),
}


def _transform_values(transform) -> None:
    """Transforma cada valor sem expô-lo em logs da migração."""
    connection = op.get_bind()
    for table, columns in _SENSITIVE_COLUMNS.items():
        for column in columns:
            rows = list(connection.execute(
                sa.text(f"SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL")
            ).mappings())
            for row in rows:
                connection.execute(
                    sa.text(f"UPDATE {table} SET {column} = :value WHERE id = :id"),
                    {"value": transform(row[column]), "id": row["id"]},
                )


def upgrade() -> None:
    # Ciphertext e JSON cifrado não cabem nos antigos VARCHAR/JSONB.
    op.alter_column("users", "school_name", type_=sa.Text(), existing_type=sa.String(200))
    op.alter_column("users", "discipline", type_=sa.Text(), existing_type=sa.String(100))
    op.alter_column("users", "grade", type_=sa.Text(), existing_type=sa.String(50))
    op.alter_column(
        "turma_membros", "display_name", type_=sa.Text(), existing_type=sa.String(100)
    )
    op.alter_column("essays", "title", type_=sa.Text(), existing_type=sa.String(200))
    op.alter_column("essays", "theme", type_=sa.Text(), existing_type=sa.String(500))

    for column in ("competencies", "highlights", "insights"):
        op.alter_column(
            "corrections",
            column,
            type_=sa.Text(),
            existing_type=postgresql.JSONB(),
            postgresql_using=f"{column}::text",
        )
    for column in (
        "original_competencies",
        "original_highlights",
        "original_insights",
        "corrected_competencies",
    ):
        op.alter_column(
            "correction_appeals",
            column,
            type_=sa.Text(),
            existing_type=postgresql.JSONB(),
            postgresql_using=f"{column}::text",
        )

    _transform_values(encrypt_text)


def downgrade() -> None:
    _transform_values(decrypt_text)

    for column in ("competencies", "highlights", "insights"):
        op.alter_column(
            "corrections",
            column,
            type_=postgresql.JSONB(),
            existing_type=sa.Text(),
            postgresql_using=f"{column}::jsonb",
        )
    for column in (
        "original_competencies",
        "original_highlights",
        "original_insights",
        "corrected_competencies",
    ):
        op.alter_column(
            "correction_appeals",
            column,
            type_=postgresql.JSONB(),
            existing_type=sa.Text(),
            postgresql_using=f"{column}::jsonb",
        )

    op.alter_column("essays", "theme", type_=sa.String(500), existing_type=sa.Text())
    op.alter_column("essays", "title", type_=sa.String(200), existing_type=sa.Text())
    op.alter_column(
        "turma_membros", "display_name", type_=sa.String(100), existing_type=sa.Text()
    )
    op.alter_column("users", "grade", type_=sa.String(50), existing_type=sa.Text())
    op.alter_column("users", "discipline", type_=sa.String(100), existing_type=sa.Text())
    op.alter_column("users", "school_name", type_=sa.String(200), existing_type=sa.Text())
