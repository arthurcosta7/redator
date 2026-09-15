# Desenvolvimento local

## Pré-requisitos

- Python 3.11 ou superior
- Node.js 20 LTS ou superior e npm
- Docker com Compose
- Git

Chaves de OpenAI, Google Vision, Stripe e Resend são necessárias apenas para exercitar os respectivos fluxos reais.

## 1. Infraestrutura

Na raiz do projeto:

```bash
docker compose up -d
docker compose ps
```

Isso expõe PostgreSQL em `localhost:5433` e Redis em `localhost:6379`. Os dados ficam em volumes Docker.

## 2. Backend

No Windows PowerShell:

```powershell
Set-Location backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

No Linux/macOS:

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
test -f .env || cp .env.example .env
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

No `.env` local, use:

```dotenv
DATABASE_URL=postgresql+asyncpg://redator_user:redator_dev_password@localhost:5433/redator_db
REDIS_URL=redis://:redator_redis_dev@localhost:6379/0
ALLOWED_ORIGINS=["http://localhost:3000"]
FRONTEND_URL=http://localhost:3000
```

Em outro terminal, com o mesmo ambiente virtual:

```powershell
Set-Location backend
.\.venv\Scripts\arq.exe app.workers.correction.WorkerSettings
```

Sem o worker, novas redações permanecem `pending`.

## 3. Frontend

```bash
cd frontend
npm ci
cp .env.local.example .env.local
npm run dev
```

Abra `http://localhost:3000`. A API fica em `http://localhost:8000`, o Swagger em `http://localhost:8000/docs` e os probes em `/health` e `/ready`.

## Comandos cotidianos

```bash
# backend
pytest
ruff check app tests
ruff format --check app tests
mypy app
alembic revision --autogenerate -m "descricao"
alembic upgrade head

# frontend
npm run type-check
npm run build
```

O script `npm run lint` deve ser validado ao atualizar Next/ESLint; o build e o type-check são as verificações de referência atuais.

## Encerrar

```bash
docker compose down
```

Não use `docker compose down -v` sem intenção explícita: ele remove os dados locais do banco e Redis.
