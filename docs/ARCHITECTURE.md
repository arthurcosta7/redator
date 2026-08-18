# Arquitetura

## Visão geral

```mermaid
flowchart LR
    U["Navegador"] --> V["Frontend Next.js 15 / Vercel"]
    V --> N["Nginx com TLS e limites"]
    N --> A["API FastAPI"]
    A --> P[("PostgreSQL 16")]
    A --> R[("Redis 7")]
    A --> S["Stripe"]
    A --> E["Resend"]
    A --> O["Google Vision"]
    A -->|"enfileira"| R
    R --> W["Worker ARQ"]
    W --> I["OpenAI Responses API"]
    W --> P
```

O frontend usa App Router, React 19, TypeScript, Tailwind e Framer Motion. O backend é assíncrono, usa FastAPI/Pydantic, SQLAlchemy/asyncpg, PostgreSQL e Redis. Correções de IA saem do caminho síncrono da API e são processadas pelo worker ARQ.

## Fluxo de uma correção

```mermaid
sequenceDiagram
    participant C as Cliente
    participant A as API
    participant D as PostgreSQL
    participant Q as Redis/ARQ
    participant W as Worker
    participant AI as OpenAI
    C->>A: POST /api/v1/essays
    A->>A: autentica, valida e aplica cota
    A->>D: cria essay=pending
    A->>Q: job único por essay_id
    A-->>C: redação pendente
    W->>D: muda para processing
    W->>AI: solicita correção estruturada
    AI-->>W: avaliação
    W->>D: grava correction e completed
    C->>A: GET /api/v1/essays/{id}
    A-->>C: resultado ou estado atual
```

Jobs usam ID determinístico e a tabela de correções impõe unicidade por redação. Tentativas repetidas não devem produzir duas correções.

## Estrutura do repositório

```text
backend/
  app/api/v1/endpoints/  rotas HTTP
  app/core/              configuração, segurança, middleware, fila
  app/db/models/         modelos SQLAlchemy
  app/schemas/           contratos Pydantic
  app/services/          IA, OCR, Stripe e email
  app/workers/           consumidores ARQ
  alembic/versions/      histórico do schema
  tests/                 unitários, integração e carga
frontend/
  src/app/               páginas e layouts Next.js
  src/components/        componentes de domínio e UI
  src/contexts/          estado global de usuário
  src/lib/api/           cliente HTTP
docs/                    documentação técnica e operacional
nginx/                   proxy reverso de produção
```

## Limites de responsabilidade

- Frontend melhora UX, mas não é fronteira de segurança.
- API autentica, autoriza, valida, aplica cotas e persiste estados.
- Worker executa operações caras e tolera retry.
- PostgreSQL é a fonte de verdade de negócio.
- Redis guarda fila, rate limits e contadores atômicos; em produção usa AOF e `noeviction`.
- Provedores externos devem ser tratados como lentos e potencialmente indisponíveis.

Consulte [Escalabilidade](SCALABILITY.md) para capacidade e backpressure e [Segurança](SECURITY.md) para as fronteiras de confiança.
