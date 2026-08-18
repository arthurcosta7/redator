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

```bash
cd backend
python -m venv .venv
```

Ative o ambiente (`.venv\Scripts\Activate.ps1` no PowerShell ou `source .venv/bin/activate` em Linux/macOS) e execute:

```bash
python -m pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

No `.env` local, use:

```dotenv
DATABASE_URL=postgresql+asyncpg://redator_user:redator_dev_password@localhost:5433/redator_db
REDIS_URL=redis://:redator_redis_dev@localhost:6379/0
ALLOWED_ORIGINS=["http://localhost:3000"]
FRONTEND_URL=http://localhost:3000
```

Em outro terminal, com o mesmo ambiente virtual:

```bash
cd backend
arq app.workers.correction.WorkerSettings
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
