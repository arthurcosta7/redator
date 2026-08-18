# 📝 Redator — Plataforma de Correção de Redações com IA

Plataforma que corrige redações no modelo ENEM e Vestibular Tradicional usando
Inteligência Artificial, com feedback detalhado e fiel ao corretor humano.

## 📁 Estrutura do Projeto

```
redator/
├── backend/          # Python FastAPI — API e lógica de negócio
├── frontend/         # Next.js 14 — Interface do usuário
├── docker-compose.yml
└── README.md
```

## 🚀 Como rodar localmente

> **Arquitetura de desenvolvimento:** Docker sobe apenas o banco e o cache.
> Backend (FastAPI) e Frontend (Next.js) rodam nativamente para hot-reload instantâneo.

### Pré-requisitos

| Ferramenta | Versão mínima | Para quê |
|---|---|---|
| Docker Desktop | qualquer | PostgreSQL + Redis |
| Python | 3.11+ | Backend FastAPI |
| Node.js | 20+ | Frontend Next.js |

---

### Passo 1 — Infraestrutura (Docker)

Sobe apenas o **PostgreSQL** (porta `5433`) e o **Redis** (porta `6379`):

```bash
docker compose up -d
```

Verificar se está saudável:
```bash
docker compose ps
```

Parar tudo:
```bash
docker compose down
```

---

### Passo 2 — Backend (FastAPI)

> O ambiente virtual já está criado em `backend/.venv`. Se não existir, veja "Primeiro uso" abaixo.

```bash
cd backend

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

# Iniciar com hot-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Endpoints disponíveis após iniciar:**
- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

#### Primeiro uso (criar o ambiente virtual)

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

pip install -e ".[dev]"
```



### Passo 3 — Frontend (Next.js)

```bash
cd frontend

# Instalar dependências (só na primeira vez)
npm install

# Iniciar em modo desenvolvimento
npm run dev
```

Acessar em: **http://localhost:3000**

Outros comandos úteis:
```bash
npm run build        # Build de produção
npm run start        # Servir build de produção
npm run lint         # Lint com ESLint
npm run type-check   # Verificar tipos TypeScript
```

---

### Resumo rápido (dia a dia)

Abra **3 terminais** em paralelo:

```bash
# Terminal 1 — Infraestrutura
docker compose up -d

# Terminal 2 — Backend
cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && npm run dev
```

---

### Banco de dados — Conexão direta

```bash
# Acessar o PostgreSQL via psql (dentro do container)
docker exec -it redator_postgres psql -U redator_user -d redator_db

# Ou via cliente externo (TablePlus, DBeaver, etc.)
Host:     localhost
Porta:    5433          ← atenção: 5433, não 5432
Banco:    redator_db
Usuário:  redator_user
Senha:    redator_dev_password
```

Comandos úteis dentro do `psql`:
```sql
\dt                         -- listar tabelas
\d users                    -- estrutura da tabela users
SELECT email, user_type, admin_role FROM users;
```

---

### Configurar conta Superadmin

Após criar sua conta normalmente pelo frontend, rode no `psql`:

```sql
UPDATE users
SET admin_role = 'SUPERADMIN'
WHERE email = 'seu-email@exemplo.com';
```

Acesse o painel em: **http://localhost:3000/dashboard/admin**

---

### Solução de problemas comuns

| Problema | Causa provável | Solução |
|---|---|---|
| Backend não inicia | `.env` ausente ou `SECRET_KEY` faltando | Copiar `backend/.env.example` → `backend/.env` e preencher |
| Erro de conexão com DB | PostgreSQL não está rodando | `docker compose up -d` |
| Porta 5433 ocupada | PostgreSQL local na mesma porta | Alterar `DATABASE_URL` para outra porta no `.env` |
| `ModuleNotFoundError` no backend | Dependências não instaladas | `pip install -e ".[dev]"` dentro do venv |
| Erro CORS no browser | Backend não está rodando | Verificar se uvicorn está ativo na porta 8000 |
| `npm: command not found` | Node.js não instalado | Instalar Node.js 20+ em nodejs.org |

## 🔐 Segurança

Este projeto foi desenvolvido com **Security by Design**:
- Autenticação JWT com httpOnly cookies
- Rate limiting por usuário e por plano
- Validação rigorosa de todos os inputs (Pydantic + Zod)
- Headers de segurança (CSP, HSTS, X-Frame-Options, etc.)
- Proteção contra SQLi via ORM (SQLAlchemy)
- Proteção contra XSS via sanitização
- Logs sem dados sensíveis

## 📚 Planos

| Recurso | Free | Standard | Pro |
|---------|------|----------|-----|
| Correções/dia | 1 | 3 | Ilimitadas |
| Foto → Texto (OCR) | ✅ | ✅ | ✅ |
| Análise por competências | Básica | Avançada | Avançada |
| Grifes no texto | ❌ | ✅ | ✅ |
| Simulados completos | ❌ | ✅ | ✅ |
| Suporte prioritário | ❌ | ❌ | ✅ |

## 🛠️ Tecnologias

**Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0, PostgreSQL, Redis, Alembic  
**Frontend**: Next.js 14, TypeScript, Tailwind CSS, Zod  
**IA**: OpenAI Responses API
**OCR**: Google Cloud Vision  
**Pagamentos**: Stripe  
**Email**: Resend
