# Troubleshooting

## Redação fica em `pending`

O worker provavelmente não está ativo ou não alcança Redis. Inicie `arq app.workers.correction.WorkerSettings` localmente ou `correction_worker` no Compose e examine seus logs.

## `/ready` retorna 503

Banco ou Redis não está acessível. Confirme containers, credenciais, host/porta e TLS. Localmente, PostgreSQL usa porta `5433`; dentro do Compose usa `postgres:5432`.

## Erro de CORS ou sessão não persiste

Confira `ALLOWED_ORIGINS` como JSON exato, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL` e HTTPS. Não use `*` com cookies. Em produção, frontend e API precisam de domínios coerentes com a política `SameSite=Strict` adotada.

## Migração falha

Execute `alembic current` e `alembic history`, valide `DATABASE_URL` e procure migration parcialmente aplicada. Não apague a tabela `alembic_version` nem marque revisions manualmente sem entender o estado real.

## Correção retorna `error`

Procure o ID nos logs do worker. Causas comuns: chave/modelo OpenAI inválido, timeout, rate limit, resposta estruturada inválida ou limite de saída. Não registre o texto integral para diagnosticar.

## Upload de foto é rejeitado

Verifique limite configurado, JPEG/PNG/WebP real, arquivo íntegro e dimensões abaixo de 40 milhões de pixels. Extensão de arquivo não substitui assinatura MIME.

## OCR falha

Confirme `GOOGLE_APPLICATION_CREDENTIALS`, permissão do arquivo/conta, API Vision habilitada, faturamento, cotas e `GOOGLE_VISION_API_ENDPOINT`. Na VPS, confirme se `GOOGLE_VISION_CREDENTIALS_FILE` existe no host e se o secret aparece em `/run/secrets/google_cloud_vision_credentials` somente no container do backend. Não há fallback para OpenAI ou Tesseract: falha do Google retorna `503` e devolve o crédito; imagem processada sem texto suficiente retorna `422`.

## Checkout ou assinatura não atualiza

Confira Price IDs, modo test/live consistente, endpoint de webhook, `STRIPE_WEBHOOK_SECRET` e eventos nos logs do Stripe. Reenviar um evento deve ser seguro.

## Email não chega

Valide chave Resend, domínio/remetente, spam e logs. Respostas genéricas de recuperação não provam que um email foi enviado, por desenho de segurança.

## Build do frontend falha

Use Node 20+, rode `npm ci`, depois `npm run type-check` e `npm run build`. Apague artefatos gerados somente se tiver confirmado que não contêm trabalho do usuário.

## Porta ocupada

O Compose de desenvolvimento escolhe PostgreSQL `5433` para evitar conflito. Identifique o processo/serviço antes de alterar portas e mantenha `.env` sincronizado.
