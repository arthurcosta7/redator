# Configuração

Em desenvolvimento, copie `backend/.env.example` para `backend/.env` e `frontend/.env.local.example` para `frontend/.env.local`. Em deploy Docker, copie `.env.production.example` para `.env` na raiz: esse único arquivo alimenta o Compose, a API e o worker. Arquivos reais de ambiente nunca devem entrar no Git.

## Backend

| Grupo | Variáveis |
|---|---|
| Aplicação | `APP_NAME`, `DEBUG`, `ENVIRONMENT`, `ACCESS_LOG_SUCCESS_SAMPLE_RATE` |
| Autenticação e criptografia | `SECRET_KEY`, `DATA_ENCRYPTION_KEY`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, `JWT_REFRESH_TOKEN_EXPIRE_DAYS` |
| Rede | `ALLOWED_ORIGINS`, `FRONTEND_URL` |
| PostgreSQL | `DATABASE_URL`, `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`, `DATABASE_POOL_TIMEOUT_SECONDS`, `DATABASE_POOL_RECYCLE_SECONDS` |
| Redis | `REDIS_URL`, `REDIS_MAX_CONNECTIONS`, `REDIS_SOCKET_TIMEOUT_SECONDS`, `REDIS_CONNECT_TIMEOUT_SECONDS` |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_CORRECTION_MODEL`, `OPENAI_FREE_MODEL`, `OPENAI_PAID_MODEL`, `OPENAI_MAX_OUTPUT_TOKENS`, `OPENAI_TIMEOUT_SECONDS`, `OPENAI_MAX_RETRIES` |
| Custo/cache de IA | `ESSAY_CORRECTION_PROMPT_VERSION`, `OPENAI_INPUT_PRICE_PER_MILLION`, `OPENAI_CACHED_INPUT_PRICE_PER_MILLION`, `OPENAI_OUTPUT_PRICE_PER_MILLION`, `OPENAI_CACHE_WRITE_MULTIPLIER` |
| Fila | `CORRECTION_WORKER_MAX_JOBS`, `CORRECTION_JOB_TIMEOUT_SECONDS`, `CORRECTION_JOB_MAX_TRIES`, `CORRECTION_JOB_EXPIRES_SECONDS` |
| OCR | `GOOGLE_APPLICATION_CREDENTIALS`, `OPENAI_OCR_MODEL`, `OCR_TIMEOUT_SECONDS`, `OCR_MAX_CONCURRENCY` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, preços mensais Standard/Pro e Professor 30/60/100; IDs trimestrais e `STRIPE_PRICE_TEACHER_PACKAGE` existem apenas para assinaturas legadas |
| Email | `RESEND_API_KEY`, `FROM_EMAIL`, `FROM_NAME` |
| Planos | `PLAN_*_MONTHLY_CORRECTIONS` e `PLAN_*_MONTHLY_SIMULATIONS` |
| Upload | `MAX_FILE_SIZE_MB`, `ALLOWED_IMAGE_TYPES` |

Listas como `ALLOWED_ORIGINS` e `ALLOWED_IMAGE_TYPES` devem usar JSON válido. Em produção, a validação exige segredos fortes, origens HTTPS explícitas, autenticação de banco/Redis e configuração completa de OpenAI, Stripe e Resend. PostgreSQL e Redis dentro da rede privada do Compose podem usar conexão local sem TLS; serviços externos exigem TLS.

## Frontend

| Variável | Uso | Exposição |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Origem pública da API, sem `/api/v1` | Pública |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave publicável do Stripe | Pública |
| `NEXT_PUBLIC_APP_NAME` | Nome exibido | Pública |

Tudo com prefixo `NEXT_PUBLIC_` é incorporado ao bundle. Nunca coloque segredo, chave privada ou credencial nesse namespace.

`OPENAI_API_KEY` existe somente no backend e no worker. Não a cadastre na
Vercel do frontend nem crie uma variável `NEXT_PUBLIC_OPENAI_API_KEY`. Ao
alterar prompt, schema ou modelo de correção, incremente a versão lógica para
separar cache e telemetria.

Atualmente, `OPENAI_FREE_MODEL` aponta para `gpt-5.6-luna` e atende correções pessoais Free. `OPENAI_PAID_MODEL` aponta para `gpt-5.4-mini` e atende correções pessoais Standard/Pro e redações vinculadas a tarefas. `OPENAI_CORRECTION_MODEL` permanece apenas para compatibilidade e medições legadas.

## Segredos e rotação

- Gere `SECRET_KEY` com pelo menos 64 caracteres aleatórios.
- Gere `DATA_ENCRYPTION_KEY` como 32 bytes em Base64 URL-safe e nunca reutilize `SECRET_KEY`.
- Use chaves distintas em desenvolvimento, staging e produção.
- Armazene segredos no provedor de deploy, não em imagens Docker.
- Na VPS, mantenha o `.env` raiz com permissão `600` e acesso apenas ao usuário de deploy.
- Após suspeita de vazamento, revogue a chave no provedor, substitua o valor e reinicie API e worker.
- Rotacionar `SECRET_KEY` invalida tokens JWT existentes; planeje a janela.
- Não remova nem troque `DATA_ENCRYPTION_KEY` diretamente: sem ela, redações e correções já cifradas ficam ilegíveis. Faça rotação por migração controlada e mantenha backup seguro da chave.

Os valores de desenvolvimento estão em [`backend/.env.example`](../backend/.env.example) e [`frontend/.env.local.example`](../frontend/.env.local.example). A fonte de produção é [`.env.production.example`](../.env.production.example); variáveis públicas do frontend devem ser cadastradas diretamente no projeto da Vercel.
