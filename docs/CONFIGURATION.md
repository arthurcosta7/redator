# Configuração

Em desenvolvimento, copie `backend/.env.example` para `backend/.env` e `frontend/.env.local.example` para `frontend/.env.local`. Em deploy Docker, copie `.env.production.example` para `.env` na raiz: esse único arquivo alimenta o Compose, a API e o worker. Arquivos reais de ambiente nunca devem entrar no Git.

## Backend

| Grupo | Variáveis |
|---|---|
| Aplicação | `APP_NAME`, `DEBUG`, `ENVIRONMENT`, `ACCESS_LOG_SUCCESS_SAMPLE_RATE` |
| Autenticação | `SECRET_KEY`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, `JWT_REFRESH_TOKEN_EXPIRE_DAYS` |
| Rede | `ALLOWED_ORIGINS`, `FRONTEND_URL` |
| PostgreSQL | `DATABASE_URL`, `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`, `DATABASE_POOL_TIMEOUT_SECONDS`, `DATABASE_POOL_RECYCLE_SECONDS` |
| Redis | `REDIS_URL`, `REDIS_MAX_CONNECTIONS`, `REDIS_SOCKET_TIMEOUT_SECONDS`, `REDIS_CONNECT_TIMEOUT_SECONDS` |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_FREE_MODEL`, `OPENAI_PAID_MODEL`, `OPENAI_MAX_OUTPUT_TOKENS`, `OPENAI_TIMEOUT_SECONDS`, `OPENAI_MAX_RETRIES` |
| Fila | `CORRECTION_WORKER_MAX_JOBS`, `CORRECTION_JOB_TIMEOUT_SECONDS`, `CORRECTION_JOB_MAX_TRIES`, `CORRECTION_JOB_EXPIRES_SECONDS` |
| OCR | `GOOGLE_APPLICATION_CREDENTIALS`, `OCR_TIMEOUT_SECONDS`, `OCR_MAX_CONCURRENCY` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, quatro preços de assinatura e `STRIPE_PRICE_TEACHER_PACKAGE` |
| Email | `RESEND_API_KEY`, `FROM_EMAIL`, `FROM_NAME` |
| Planos | `PLAN_FREE_DAILY_CORRECTIONS`, `PLAN_STANDARD_DAILY_CORRECTIONS`, `PLAN_PRO_DAILY_CORRECTIONS` |
| Upload | `MAX_FILE_SIZE_MB`, `ALLOWED_IMAGE_TYPES` |

Listas como `ALLOWED_ORIGINS` e `ALLOWED_IMAGE_TYPES` devem usar JSON válido. Em produção, a validação exige segredos fortes, origens HTTPS explícitas, autenticação de banco/Redis e configuração completa de OpenAI, Stripe e Resend. PostgreSQL e Redis dentro da rede privada do Compose podem usar conexão local sem TLS; serviços externos exigem TLS.

## Frontend

| Variável | Uso | Exposição |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Origem pública da API, sem `/api/v1` | Pública |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave publicável do Stripe | Pública |
| `NEXT_PUBLIC_APP_NAME` | Nome exibido | Pública |

Tudo com prefixo `NEXT_PUBLIC_` é incorporado ao bundle. Nunca coloque segredo, chave privada ou credencial nesse namespace.

## Segredos e rotação

- Gere `SECRET_KEY` com pelo menos 64 caracteres aleatórios.
- Use chaves distintas em desenvolvimento, staging e produção.
- Armazene segredos no provedor de deploy, não em imagens Docker.
- Na VPS, mantenha o `.env` raiz com permissão `600` e acesso apenas ao usuário de deploy.
- Após suspeita de vazamento, revogue a chave no provedor, substitua o valor e reinicie API e worker.
- Rotacionar `SECRET_KEY` invalida tokens JWT existentes; planeje a janela.

Os valores de desenvolvimento estão em [`backend/.env.example`](../backend/.env.example) e [`frontend/.env.local.example`](../frontend/.env.local.example). A fonte de produção é [`.env.production.example`](../.env.production.example); variáveis públicas do frontend devem ser cadastradas diretamente no projeto da Vercel.
