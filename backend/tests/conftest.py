"""
conftest.py — Configuração dos testes

Define fixtures reutilizáveis em todos os testes.
Fixtures são funções que criam dados ou dependências para os testes.
"""
import asyncio
import logging
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.main import app

logging.getLogger("aiosqlite").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# Banco de dados em memória para testes (SQLite assíncrono)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(type_, compiler, **kw):
    """Permite criar os modelos PostgreSQL no SQLite usado pelos testes."""
    return "JSON"


@pytest.fixture(scope="session")
def event_loop():
    """Cria um event loop para a sessão de testes."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Cria um banco de dados limpo para cada teste.

    Cada teste começa com um banco vazio e é descartado ao final.
    Isso garante que os testes são independentes e não interferem uns nos outros.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Cria as tabelas
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession)

    async with session_factory() as session:
        yield session

    # Limpa as tabelas
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """
    Cria um cliente HTTP assíncrono para testar os endpoints.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


@pytest.fixture
def valid_student_data() -> dict:
    """Dados válidos para registro de aluno."""
    return {
        "full_name": "João da Silva",
        "email": "joao.silva@email.com",
        "password": "SenhaSegura123",
        "grade": "3º ano EM",
    }


@pytest.fixture
def valid_teacher_data() -> dict:
    """Dados válidos para registro de professor."""
    return {
        "full_name": "Maria Professora",
        "email": "maria.prof@escola.com",
        "password": "SenhaSegura123",
        "school_name": "Escola Estadual",
        "discipline": "Língua Portuguesa",
    }
