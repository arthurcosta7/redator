"""
middleware.py — Middlewares de segurança

Middlewares são executados em TODA requisição, antes de chegar ao endpoint.
Aqui configuramos os headers de segurança que protegem o frontend.

Headers implementados:
- Content-Security-Policy (CSP): bloqueia scripts maliciosos
- Strict-Transport-Security (HSTS): força HTTPS
- X-Frame-Options: bloqueia clickjacking
- X-Content-Type-Options: bloqueia MIME sniffing
- Referrer-Policy: controla o header Referer
- Permissions-Policy: desativa APIs do browser não utilizadas
"""
import time
import uuid
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adiciona headers de segurança em todas as respostas.

    Por que isso é importante?
    - CSP: Se alguém conseguir injetar um <script> na página (XSS),
      o CSP impede que o script malicioso execute ou envie dados.
    - HSTS: Garante que o browser SEMPRE use HTTPS, mesmo se o usuário
      digitar http:// manualmente.
    - X-Frame-Options: Impede que seu site seja embutido em um iframe
      em outro site (ataque de clickjacking).
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # HSTS: força HTTPS por 1 ano, inclui subdomínios
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Bloqueia clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Impede que o browser adivinhe o tipo de conteúdo (MIME sniffing)
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Controla o Referer header (não envia para outros domínios)
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Desativa APIs do browser que não usamos
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), "
            "usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
        )

        # Remove headers que revelam tecnologia usada
        if "server" in response.headers:
            del response.headers["server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        return response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Adiciona um ID único a cada requisição para rastreamento nos logs.

    Sem isso, é impossível correlacionar logs de uma mesma requisição
    que passou por múltiplos serviços ou gerou múltiplos logs.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Pega o request-id do cliente ou gera um novo
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = time.perf_counter() - start_time

        # Adiciona o ID e tempo de resposta nos headers de resposta
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.3f}s"

        # Log de acesso (sem dados sensíveis)
        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,          # Caminho, sem query string (pode ter dados sensíveis)
            status_code=response.status_code,
            process_time_ms=round(process_time * 1000, 2),
            request_id=request_id,
        )

        return response


def setup_middlewares(app: FastAPI) -> None:
    """
    Registra todos os middlewares na aplicação FastAPI.

    IMPORTANTE: A ordem importa! O último middleware registrado
    é o primeiro a executar (pilha LIFO).
    """

    # GZip: comprime respostas grandes (performance)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Headers de segurança (executa por último, pois adicionamos headers à resposta)
    app.add_middleware(SecurityHeadersMiddleware)

    # ID de requisição (executa antes dos headers de segurança)
    app.add_middleware(RequestIDMiddleware)

    # CORS: Define quais origens podem chamar a API
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,         # Necessário para enviar cookies
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-Request-ID",
            "X-CSRF-Token",
            "X-Requested-With",         # Alguns clientes HTTP enviam este header
        ],
        # Headers expostos ao frontend
        expose_headers=["X-Request-ID", "X-Process-Time"],
    )
