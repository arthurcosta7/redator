# Configuração

Copie `backend/.env.example` para `backend/.env` e `frontend/.env.local.example` para `frontend/.env.local`. Arquivos reais de ambiente nunca devem entrar no Git.

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

Listas como `ALLOWED_ORIGINS` e `ALLOWED_IMAGE_TYPES` devem usar JSON válido. Em produção, a validação de configuração exige segredos fortes, origens HTTPS explícitas e conexões TLS para serviços externos.

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
- Após suspeita de vazamento, revogue a chave no provedor, substitua o valor e reinicie API e worker.
- Rotacionar `SECRET_KEY` invalida tokens JWT existentes; planeje a janela.

Os valores e comentários canônicos estão em [`backend/.env.example`](../backend/.env.example) e [`frontend/.env.local.example`](../frontend/.env.local.example).
