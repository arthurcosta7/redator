"""add_tarefa_is_closed

Revision ID: b7d2e4f1a390
Revises: a3f9c1e8b205
Create Date: 2026-05-28 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b7d2e4f1a390'
down_revision: Union[str, None] = 'a3f9c1e8b205'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tarefas',
        sa.Column('is_closed', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('tarefas', 'is_closed')
