"""Marketing roles, click aggregates, first payment and internal CRM.

Revision ID: c7d4e8f921ab
Revises: b1e7c9d3a540
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c7d4e8f921ab"
down_revision: str | None = "b1e7c9d3a540"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # PostgreSQL enum ganha valores antes de qualquer usuário receber a nova role.
    op.execute("ALTER TYPE admin_role_enum ADD VALUE IF NOT EXISTS 'SALES'")
    op.execute("ALTER TYPE admin_role_enum ADD VALUE IF NOT EXISTS 'MARKETING_MANAGER'")
    op.add_column("referral_attributions", sa.Column("first_payment_cents", sa.Integer(), nullable=True))
    op.create_table(
        "referral_clicks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("link_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("referral_links.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_index("ix_referral_clicks_link_id", "referral_clicks", ["link_id"])
    op.create_index("ix_referral_clicks_created_at", "referral_clicks", ["created_at"])
    op.create_table(
        "marketing_leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text()),
        sa.Column("phone", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("consent_recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('new', 'contacted', 'negotiating', 'converted', 'lost')", name="ck_marketing_lead_status"),
    )
    op.create_index("ix_marketing_leads_owner_id", "marketing_leads", ["owner_id"])
    op.create_index("ix_marketing_leads_status", "marketing_leads", ["status"])
    op.create_index("ix_marketing_leads_created_at", "marketing_leads", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_marketing_leads_created_at", table_name="marketing_leads")
    op.drop_index("ix_marketing_leads_status", table_name="marketing_leads")
    op.drop_index("ix_marketing_leads_owner_id", table_name="marketing_leads")
    op.drop_table("marketing_leads")
    op.drop_index("ix_referral_clicks_created_at", table_name="referral_clicks")
    op.drop_index("ix_referral_clicks_link_id", table_name="referral_clicks")
    op.drop_table("referral_clicks")
    op.drop_column("referral_attributions", "first_payment_cents")
    # PostgreSQL não remove valores de enum em downgrade sem recriá-lo; as
    # roles são deixadas inertes até a próxima migração de esquema.
