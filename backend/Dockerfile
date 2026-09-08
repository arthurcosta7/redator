# ─────────────────────────────────────────────────────────────
# Dockerfile — Backend Python FastAPI
# Usa multi-stage build para imagem menor e mais segura
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Builder (instala dependências) ──────────────────
FROM python:3.11-slim AS builder

# Evita que o Python crie arquivos .pyc desnecessários
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /build

# Instala apenas o necessário para compilar dependências
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia metadados e o pacote necessário para construir um wheel completo.
COPY pyproject.toml .
COPY app ./app

# Instala dependências em um diretório separado
RUN pip install --no-cache-dir --upgrade "pip>=26.2.1" && \
    pip install --no-cache-dir --prefix=/install .


# ── Stage 2: Runtime (imagem final, menor e mais segura) ─────
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Cria usuário não-root para rodar a aplicação
# SEGURANÇA: Nunca rode aplicações como root em produção
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid 1000 --no-create-home --shell /bin/false appuser

# Instala apenas dependências de runtime do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia dependências instaladas do builder
COPY --from=builder /install /usr/local

# Copia o código da aplicação
COPY --chown=appuser:appuser . .

# Falha o build caso o pacote não tenha sido instalado no runtime. Instalações
# editáveis apontariam para o estágio builder, que não existe na imagem final.
RUN cd /tmp && python -c "import app; assert '/build' not in str(app.__path__)"

# Muda para usuário não-root
USER appuser

# Expõe a porta (apenas documentação, não abre a porta por si só)
EXPOSE 8000

# Healthcheck para o Docker saber se o container está saudável
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

# Comando de inicialização
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
