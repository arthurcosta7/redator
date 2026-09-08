"""add_turmas_e_tarefas

Revision ID: a3f9c1e8b205
Revises: 67ec5b2ed9fd
Create Date: 2026-05-27 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a3f9c1e8b205'
down_revision: Union[str, None] = '67ec5b2ed9fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alguns bancos anteriores ao Alembic ja possuem estas tabelas. Em uma
    # instalacao nova elas precisam ser criadas antes de tarefas, que referencia
    # turmas por chave estrangeira.
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())

    if 'turmas' not in existing_tables:
        op.create_table(
            'turmas',
            sa.Column('teacher_id', sa.UUID(), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['teacher_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_turmas_teacher_id'), 'turmas', ['teacher_id'], unique=False)

    if 'turma_membros' not in existing_tables:
        membro_status = postgresql.ENUM(
            'pending',
            'active',
            'removed',
            name='turma_membro_status_enum',
            create_type=False,
        )
        membro_status.create(op.get_bind(), checkfirst=True)
        op.create_table(
            'turma_membros',
            sa.Column('turma_id', sa.UUID(), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=True),
            sa.Column('display_name', sa.String(length=100), nullable=True),
            sa.Column('status', membro_status, nullable=False),
            sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('id', sa.UUID(), nullable=False),
            sa.ForeignKeyConstraint(['turma_id'], ['turmas.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_turma_membros_turma_id'), 'turma_membros', ['turma_id'], unique=False)
        op.create_index(op.f('ix_turma_membros_user_id'), 'turma_membros', ['user_id'], unique=False)

    # --- teacher_student_slots on users ---
    op.add_column(
        'users',
        sa.Column('teacher_student_slots', sa.Integer(), nullable=False, server_default='0'),
    )

    # --- tarefas ---
    op.create_table(
        'tarefas',
        sa.Column('turma_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('essay_type', sa.String(length=20), nullable=False),
        sa.Column('theme', sa.String(length=500), nullable=False),
        sa.Column('motivating_texts', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_ai_generated', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['turma_id'], ['turmas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tarefas_turma_id'), 'tarefas', ['turma_id'], unique=False)

    # --- tarefa_submissoes ---
    op.create_table(
        'tarefa_submissoes',
        sa.Column('tarefa_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('essay_id', sa.UUID(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('teacher_comment', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['essay_id'], ['essays.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tarefa_id'], ['tarefas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tarefa_id', 'student_id', name='uq_tarefa_submissao'),
    )
    op.create_index(op.f('ix_tarefa_submissoes_tarefa_id'), 'tarefa_submissoes', ['tarefa_id'], unique=False)
    op.create_index(op.f('ix_tarefa_submissoes_student_id'), 'tarefa_submissoes', ['student_id'], unique=False)
    op.create_index(op.f('ix_tarefa_submissoes_essay_id'), 'tarefa_submissoes', ['essay_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_tarefa_submissoes_essay_id'), table_name='tarefa_submissoes')
    op.drop_index(op.f('ix_tarefa_submissoes_student_id'), table_name='tarefa_submissoes')
    op.drop_index(op.f('ix_tarefa_submissoes_tarefa_id'), table_name='tarefa_submissoes')
    op.drop_table('tarefa_submissoes')

    op.drop_index(op.f('ix_tarefas_turma_id'), table_name='tarefas')
    op.drop_table('tarefas')

    op.drop_column('users', 'teacher_student_slots')
    # Nao removemos turmas e membros: em instalacoes antigas eles podem ter sido
    # criados antes do historico Alembic e conter dados que nao pertencem a esta
    # revisao.
