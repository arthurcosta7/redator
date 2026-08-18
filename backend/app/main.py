"""
main.py — Ponto de entrada da aplicação FastAPI

Este arquivo cria e configura a aplicação:
1. Define os middlewares de segurança
2. Registra os roteadores de cada módulo
3. Configura os tratadores de erro (sem vazar informações)
4. Define o endpoint de health check
"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import redis.asyncio as redis
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import delete, text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import get_logger, setup_logging
from app.core.middleware import setup_middlewares
from app.db.models.user import User
from app.db.session import AsyncSessionLocal, engine

# Inicializa o sistema de logging antes de tudo
setup_logging()
logger = get_logger(__name__)


async def _cleanup_unverified_users() -> None:
    """
    Apaga contas não verificadas com mais de 3 horas.

    Roda a cada hora em background. Usuários que se cadastraram mas não
    verificaram o email dentro do prazo precisam criar uma nova conta.
    """
    while True:
        await asyncio.sleep(3600)  # Espera 1h antes da primeira execução
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=3)
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    delete(User).where(
                        User.is_email_verified == False,  # noqa: E712
                        User.created_at < cutoff,
                    )
                )
                await db.commit()
                if result.rowcount:
                    logger.info("contas_nao_verificadas_removidas", count=result.rowcount)
        except Exception as e:
            logger.error("erro_cleanup_contas", error=str(e))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerencia o ciclo de vida da aplicação.

    O código ANTES do 'yield' roda na inicialização.
    O código DEPOIS do 'yield' roda no encerramento.
    """
    # ─── Inicialização ────────────────────────────────────────────
    logger.info("aplicacao_iniciando", version=settings.APP_VERSION, env=settings.ENVIRONMENT)

    # Testa a conexão com o banco
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("banco_de_dados_conectado")
    except Exception as e:
        logger.error("falha_conexao_banco", error=str(e))
        raise

    # Testa a conexão com o Redis
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        await redis_client.ping()
        await redis_client.close()
        logger.info("redis_conectado")
    except Exception as e:
        logger.error("falha_conexao_redis", error=str(e))
        raise

    logger.info("aplicacao_pronta")

    # Inicia limpeza periódica de contas não verificadas
    cleanup_task = asyncio.create_task(_cleanup_unverified_users())

    yield  # A aplicação fica rodando aqui

    # ─── Encerramento ─────────────────────────────────────────────
    cleanup_task.cancel()
    logger.info("aplicacao_encerrando")
    await engine.dispose()
    logger.info("conexoes_fechadas")


# Cria a aplicação FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Plataforma de correção de redações com IA",
    lifespan=lifespan,
    # SEGURANÇA: Em produção, desabilita a documentação interativa
    # (evita expor estrutura da API publicamente)
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    openapi_url="/openapi.json" if settings.is_development else None,
)

# Configura todos os middlewares de segurança
setup_middlewares(app)

# Registra todas as rotas da API
app.include_router(api_router, prefix="/api/v1")


# ─────────────────────────────────────────────────────────────────────────────
# Tratadores de erro globais
# SEGURANÇA: Mensagens genéricas para não vazar informações internas
# ─────────────────────────────────────────────────────────────────────────────

def _cors_headers(request: Request) -> dict[str, str]:
    """
    Retorna os headers CORS para a origem da requisição.

    Exception handlers devolvem JSONResponse diretamente (fora do CORSMiddleware),
    então precisamos adicionar os headers manualmente para evitar erros de CORS
    no frontend quando o backend retorna um erro.
    """
    origin = request.headers.get("origin", "")
    if origin in settings.ALLOWED_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Trata erros de validação do Pydantic.

    Retorna quais campos falharam na validação, mas sem detalhes
    técnicos da implementação.
    """
    errors = []
    for error in exc.errors():
        field = " → ".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({
            "field": field,
            "message": error["msg"].replace("Value error, ", ""),
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Dados inválidos", "errors": errors},
        headers=_cors_headers(request),
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Trata erros internos do servidor.

    SEGURANÇA: NUNCA retorna o traceback completo em produção.
    Loga o erro internamente para diagnóstico.
    """
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "erro_interno",
        request_id=request_id,
        path=request.url.path,
        error=str(exc),
        error_type=type(exc).__name__,
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Ocorreu um erro interno. Nossa equipe foi notificada.",
            "request_id": request_id,
        },
        headers=_cors_headers(request),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Health check — Para o Docker e balanceadores de carga saberem se está vivo
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Sistema"], include_in_schema=False)
async def health_check() -> dict:
    """
    Endpoint de health check.

    SEGURANÇA: Não retorna informações sensíveis sobre a infraestrutura.
    Apenas indica se a aplicação está respondendo.
    """
    return {"status": "ok"}
