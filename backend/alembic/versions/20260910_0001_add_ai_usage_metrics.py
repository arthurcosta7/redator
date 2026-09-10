"""add prompt version and OpenAI usage metrics to corrections

Revision ID: f5a7b9c1d320
Revises: e4f6a8b0c219
Create Date: 2026-09-10 00:01:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f5a7b9c1d320"
down_revision: str | None = "e4f6a8b0c219"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("corrections", sa.Column("prompt_version", sa.String(32), nullable=True))
    op.add_column("corrections", sa.Column("openai_response_id", sa.String(100), nullable=True))
    op.add_column("corrections", sa.Column("input_tokens", sa.Integer(), nullable=True))
    op.add_column("corrections", sa.Column("cached_input_tokens", sa.Integer(), nullable=True))
    op.add_column("corrections", sa.Column("cache_write_tokens", sa.Integer(), nullable=True))
    op.add_column("corrections", sa.Column("output_tokens", sa.Integer(), nullable=True))
    op.add_column("corrections", sa.Column("total_tokens", sa.Integer(), nullable=True))
    op.add_column("corrections", sa.Column("estimated_cost_usd", sa.Numeric(12, 8), nullable=True))
    op.add_column("corrections", sa.Column("cache_hit_ratio", sa.Numeric(8, 6), nullable=True))


def downgrade() -> None:
    for column in (
        "cache_hit_ratio",
        "estimated_cost_usd",
        "total_tokens",
        "output_tokens",
        "cache_write_tokens",
        "cached_input_tokens",
        "input_tokens",
        "openai_response_id",
        "prompt_version",
    ):
        op.drop_column("corrections", column)
