# Redator

Plataforma de correção de redações com IA para alunos e professores, com avaliação ENEM/vestibular, OCR, turmas, tarefas, analytics, assinaturas e contestação humana.

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS e Framer Motion.
- Backend: FastAPI, Python 3.11+, Pydantic, SQLAlchemy assíncrono e Alembic.
- Dados e processamento: PostgreSQL 16, Redis 7 e worker ARQ.
- Integrações: OpenAI, Google Cloud Vision, Stripe e Resend.
- Produção recomendada: frontend na Vercel; API, worker e infraestrutura atrás de Nginx na VPS.

## Início rápido

```bash
# infraestrutura local
docker compose up -d

# backend (após criar/ativar o virtualenv e backend/.env)
cd backend
python -m pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# em outro terminal: worker obrigatório para correções
cd backend
arq app.workers.correction.WorkerSettings

# frontend
cd frontend
npm ci
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
