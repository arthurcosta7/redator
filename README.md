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

### Pré-requisitos
- Docker e Docker Compose instalados
- Node.js 20+ (para frontend sem Docker)
- Python 3.11+ (para backend sem Docker)

### Opção 1 — Docker (recomendado para desenvolvimento)

```bash
# Copie os arquivos de variáveis de ambiente
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# Edite os arquivos .env com suas chaves de API
# Suba todos os serviços
docker-compose up --build
```

Serviços disponíveis:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentação da API**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Opção 2 — Rodando separadamente

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Linux/Mac
pip install -e ".[dev]"
alembic upgrade head        # Cria as tabelas no banco
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

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
**IA**: Claude API (Anthropic)  
**OCR**: Google Cloud Vision  
**Pagamentos**: Stripe  
**Email**: Resend
