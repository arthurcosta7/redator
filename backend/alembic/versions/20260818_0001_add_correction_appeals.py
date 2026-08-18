"""add correction appeals and licensed teacher role

Revision ID: c91f7a2d4e10
Revises: b7d2e4f1a390
Create Date: 2026-08-18 00:01:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c91f7a2d4e10"
down_revision: Union[str, None] = "b7d2e4f1a390"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Instalacoes antigas criaram admin_role fora do primeiro snapshot Alembic.
    # Mantemos a migracao tolerante aos dois estados para evitar drift em deploy.
    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role_enum') THEN
                CREATE TYPE admin_role_enum AS ENUM (
                    'SUPERADMIN', 'ADMIN', 'ANALYST', 'SUPPORT'
                );
            END IF;
        END $$;
        """
    )
    op.execute(
        "ALTER TYPE admin_role_enum ADD VALUE IF NOT EXISTS 'LICENSED_TEACHER'"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role admin_role_enum"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_admin_role ON users (admin_role)"
    )

    appeal_status = postgresql.ENUM(
        "PENDING", "IN_REVIEW", "UPHELD", "CORRECTED",
        name="appeal_status_enum",
        create_type=False,
    )
    appeal_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "correction_appeals",
        sa.Column("correction_id", sa.UUID(), nullable=False),
        sa.Column("essay_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("reviewer_id", sa.UUID(), nullable=True),
        sa.Column("status", appeal_status, nullable=False),
        sa.Column("student_reason", sa.Text(), nullable=False),
        sa.Column(
            "allow_anonymized_improvement",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("original_total_score", sa.Float(), nullable=False),
        sa.Column("original_competencies", postgresql.JSONB(), nullable=False),
        sa.Column("original_highlights", postgresql.JSONB(), nullable=False),
        sa.Column("original_insights", postgresql.JSONB(), nullable=False),
        sa.Column("original_ai_model", sa.String(length=100), nullable=True),
        sa.Column("corrected_total_score", sa.Float(), nullable=True),
        sa.Column("corrected_competencies", postgresql.JSONB(), nullable=True),
        sa.Column("reviewer_explanation", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "training_eligible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.ForeignKeyConstraint(["correction_id"], ["corrections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["essay_id"], ["essays.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("correction_id"),
    )
    for column in ("correction_id", "essay_id", "student_id", "reviewer_id", "status", "training_eligible"):
        op.create_index(f"ix_correction_appeals_{column}", "correction_appeals", [column])


def downgrade() -> None:
    op.drop_table("correction_appeals")
    postgresql.ENUM(name="appeal_status_enum").drop(op.get_bind(), checkfirst=True)
    # PostgreSQL nao remove um valor isolado de ENUM com seguranca. O papel fica
    # disponivel no downgrade, mas sem qualquer rota que lhe conceda privilegios.
