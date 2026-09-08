# Redator

Plataforma de correção de redações com IA para alunos e professores, com avaliação ENEM/vestibular, OCR, turmas, tarefas, analytics, assinaturas e contestação humana.

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS e Framer Motion.
- Backend: FastAPI, Python 3.11+, Pydantic, SQLAlchemy assíncrono e Alembic.
- Dados e processamento: PostgreSQL 16, Redis 7 e worker ARQ.
- Integrações: OpenAI, Google Cloud Vision, Stripe e Resend.
- Produção recomendada: frontend na Vercel; API, worker e infraestrutura atrás de Nginx na VPS.

## Início rápido

Execute cada bloco em um terminal separado, sempre a partir da raiz do projeto.
O backend, o worker e o frontend permanecem em execução e, por isso, não podem
ser iniciados sequencialmente no mesmo terminal.

### Windows (PowerShell)

Terminal 1 — PostgreSQL e Redis:

```powershell
docker compose up -d --wait
docker compose ps
```

Terminal 2 — backend e migrations:

```powershell
Set-Location backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Terminal 3 — worker obrigatório para correções:

```powershell
Set-Location backend
.\.venv\Scripts\arq.exe app.workers.correction.WorkerSettings
```

Terminal 4 — frontend:

```powershell
Set-Location frontend
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.local.example .env.local }
npm run dev
```

### Linux/macOS (Bash)

Use também quatro terminais, todos abertos na raiz do projeto:

```bash
# terminal 1
docker compose up -d --wait
docker compose ps
```

```bash
# terminal 2
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
test -f .env || cp .env.example .env
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

```bash
# terminal 3
cd backend
.venv/bin/arq app.workers.correction.WorkerSettings
```

```bash
# terminal 4
cd frontend
npm ci
test -f .env.local || cp .env.local.example .env.local
npm run dev
```

O PostgreSQL local fica em `localhost:5433`, o frontend em `localhost:3000` e a API em `localhost:8000`.

## Documentação

A documentação completa começa em [`docs/README.md`](docs/README.md). Os guias principais cobrem:

- [desenvolvimento local](docs/DEVELOPMENT.md) e [configuração](docs/CONFIGURATION.md);
- [arquitetura](docs/ARCHITECTURE.md), [API](docs/API.md) e [banco](docs/DATABASE.md);
- [segurança](docs/SECURITY.md), [testes](docs/TESTING.md) e [escalabilidade](docs/SCALABILITY.md);
- [deploy](docs/DEPLOYMENT.md), [operações](docs/OPERATIONS.md) e [troubleshooting](docs/TROUBLESHOOTING.md).

Em desenvolvimento, os schemas HTTP exatos estão em `http://localhost:8000/docs`. Nunca versione arquivos `.env` reais ou dados pessoais.
