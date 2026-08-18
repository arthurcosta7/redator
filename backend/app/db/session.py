"""
session.py — Configuração da conexão com o banco de dados

Cria o engine assíncrono e a fábrica de sessões.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Argumentos extras para o driver asyncpg
# Em desenvolvimento local (sem SSL no banco), desabilita SSL explicitamente
# para evitar WinError 10054/64 no Windows com Docker
_connect_args: dict[str, object] = {}
if settings.is_development:
    _connect_args["ssl"] = False

# Engine assíncrono — mantém um pool de conexões com o banco
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,       # Conexões permanentes no pool
    max_overflow=settings.DATABASE_MAX_OVERFLOW,  # Conexões extras em pico
    pool_timeout=settings.DATABASE_POOL_TIMEOUT_SECONDS,
    pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    pool_use_lifo=True,
    pool_pre_ping=True,                           # Testa conexões antes de usar
    echo=settings.DEBUG,                          # Loga SQL em desenvolvimento
    connect_args=_connect_args,
)

# Fábrica de sessões — cria novas sessões quando necessário
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Não expira objetos após commit (mais eficiente)
    autocommit=False,
    autoflush=False,
)
