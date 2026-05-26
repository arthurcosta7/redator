"""
alembic/env.py — Configuração do Alembic para migrações de banco de dados

Como gerar uma migração após mudar um modelo:
    cd backend
    alembic revision --autogenerate -m "descreva_a_mudanca"

Como aplicar migrações:
    alembic upgrade head

Como ver histórico:
    alembic history
"""
import asyncio
import sys
from logging.config import fileConfig

# WINDOWS: asyncpg é incompatível com ProactorEventLoop (padrão no Windows)
# Força SelectorEventLoop para que as conexões TCP funcionem corretamente
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Importa a Base e todos os modelos para que o Alembic os detecte
from app.db.base import Base
import app.db.models  # noqa: F401 — Importa todos os modelos

from app.core.config import settings

# Configuração do alembic.ini
config = context.config

# Configura o logging do Alembic
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Passa a URL do banco para o Alembic via código (mais seguro que no .ini)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Metadados dos modelos — Alembic compara isso com o estado atual do banco
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Modo offline: gera o SQL sem conectar ao banco.
    Útil para revisão ou execução manual em produção.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Modo online assíncrono — para compatibilidade com asyncpg."""
    # Em desenvolvimento, desabilita SSL para evitar WinError no Windows com Docker
    connect_args: dict = {}
    if settings.is_development:
        connect_args["ssl"] = False

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Modo online: conecta ao banco e aplica as migrações."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
