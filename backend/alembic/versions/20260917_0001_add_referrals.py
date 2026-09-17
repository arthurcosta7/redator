"""Add private referral links and immutable signup attribution.

Revision ID: b1e7c9d3a540
Revises: f5a7b9c1d320
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b1e7c9d3a540"
down_revision: str | None = "f5a7b9c1d320"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "referral_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("code", sa.String(48), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("is_active", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_referral_links_code", "referral_links", ["code"], unique=True)
    op.create_index("ix_referral_links_owner_id", "referral_links", ["owner_id"])
    op.create_table(
        "referral_attributions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("link_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("referral_links.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("risk_reason", sa.String(32)),
        sa.Column("converted_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("status IN ('valid', 'review', 'rejected')", name="ck_referral_status"),
    )
    op.create_index("ix_referral_attributions_link_id", "referral_attributions", ["link_id"])
    op.create_index("ix_referral_attributions_user_id", "referral_attributions", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_referral_attributions_user_id", table_name="referral_attributions")
    op.drop_index("ix_referral_attributions_link_id", table_name="referral_attributions")
    op.drop_table("referral_attributions")
    op.drop_index("ix_referral_links_owner_id", table_name="referral_links")
    op.drop_index("ix_referral_links_code", table_name="referral_links")
    op.drop_table("referral_links")
