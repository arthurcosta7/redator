# Deploy: Vercel + VPS

Arquitetura recomendada: frontend Next.js na Vercel; Nginx, API, worker, PostgreSQL e Redis em uma VPS. Banco gerenciado é preferível quando orçamento e criticidade permitirem.

## DNS e rede

- `redator.online`/`www`: Vercel.
- `api.redator.online`: IP da VPS.
- Exponha apenas SSH restrito e portas 80/443.
- PostgreSQL e Redis não devem ter portas públicas.
- A API Docker publica somente `127.0.0.1:8000` para o Nginx local.

## VPS

1. Instale Docker Engine/Compose, Nginx e Certbot.
2. Clone o repositório em usuário sem privilégios excessivos.
3. Copie `.env.production.example` para `.env` na raiz, preencha todos os placeholders e aplique permissão `600`. Esse único arquivo configura o Compose, a API e o worker.
4. Configure URLs internas Docker em Compose; configure externamente `FRONTEND_URL=https://redator.online` e `ALLOWED_ORIGINS=["https://redator.online","https://www.redator.online"]`.
5. Copie `nginx/redator.conf`, ajuste domínios e emita certificados.
6. Execute `chmod +x deploy.sh` e depois `./deploy.sh`. O script valida a
   configuração, atualiza o código com fast-forward, cria backup, aplica as
   migrations, aguarda os health checks e registra as imagens anteriores.

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.prod.yml up -d backend correction_worker
docker compose -f docker-compose.prod.yml ps
curl -fsS https://api.redator.online/health
curl -fsS https://api.redator.online/ready
```

O `correction_worker` é obrigatório. Sem ele, submissões são aceitas mas não corrigidas.

## Vercel

1. Importe o repositório e defina `frontend` como Root Directory.
2. Use instalação `npm ci` e build `npm run build`.
3. Cadastre `NEXT_PUBLIC_API_URL=https://api.redator.online`, a chave publicável Stripe e o nome da aplicação diretamente na Vercel. Essas variáveis não pertencem ao `.env` da VPS.
4. Publique primeiro em Preview, faça smoke test e depois promova para Production.

## Provedores

- Stripe: configure os Price IDs mensais de Standard, Pro, Professor 30, 60 e 100 e o webhook para `https://api.redator.online/api/v1/webhooks/stripe`; copie o signing secret. IDs trimestrais e `STRIPE_PRICE_TEACHER_PACKAGE` só são mantidos para assinaturas legadas.
- Migre no Stripe as assinaturas antigas de pacote para um plano comercial. Até a migração, o backend reconhece o Price ID legado como Professor 30; ele nunca é oferecido em novos checkouts.
- Resend: valide o domínio remetente.
- Google Vision: crie um projeto e uma conta de serviço exclusivos para OCR,
  habilite faturamento e `vision.googleapis.com`, defina cotas e alertas de
  orçamento. Não conceda `Owner`, `Editor` ou acesso ao banco/Storage quando a
  imagem é enviada diretamente em bytes. Na VPS, coloque a credencial fora do
  repositório, por exemplo em `./secrets/google-cloud-vision.json`, com permissão
  `600`; `GOOGLE_VISION_CREDENTIALS_FILE` faz o Compose montá-la como secret
  somente no backend. Prefira Workload Identity Federation quando a operação
  permitir eliminar chaves permanentes. Nunca copie o JSON para a imagem Docker,
  worker, frontend, Vercel ou Git.
- `GOOGLE_VISION_API_ENDPOINT` aceita apenas `vision.googleapis.com`,
  `us-vision.googleapis.com` ou `eu-vision.googleapis.com`. O exemplo usa EUA;
  use o endpoint europeu quando a decisão de privacidade exigir processamento e
  armazenamento restritos à União Europeia.
- OpenAI: use projeto, limites de gasto e chave próprios do ambiente.

## Staging antes da produção

Use a mesma topologia com credenciais e domínios separados. Parta do exemplo de produção, altere `ENVIRONMENT=staging`, use `ALLOWED_ORIGINS`/`FRONTEND_URL` do Preview, Stripe em modo de teste e uma chave OpenAI com orçamento baixo. Nunca reutilize banco, Redis, webhook ou segredo JWT de produção.

## Verificação pós-deploy

- HTTPS e redirects corretos; Swagger/OpenAPI indisponíveis em produção.
- CORS aceita somente domínios previstos e cookies chegam com atributos seguros.
- Cadastro/verificação/login/logout funcionam.
- Redação de teste conclui via fila e aparece no histórico.
- Webhook atualiza assinatura no modo de teste.
- Logs não contêm senha, token, cookie ou texto integral.

Para rollback, consulte [Operações](OPERATIONS.md). Nunca faça rollback de aplicação incompatível com uma migration já aplicada.

## Scripts de release

Os scripts usam `.env` e `docker-compose.prod.yml` por padrão. `ENV_FILE` e
`COMPOSE_FILE` podem apontar para um ambiente de staging separado.

```bash
# Validação sem alterar serviços
bash scripts/preflight.sh

# Backup manual com dump custom e checksum SHA-256
bash scripts/backup-postgres.sh

# Deploy completo (na VPS, com checkout limpo)
./deploy.sh

# Rollback apenas da aplicação para as imagens anteriores
ROLLBACK_CONFIRM=redator bash scripts/rollback.sh

# Restauração destrutiva e explicitamente confirmada do banco
RESTORE_CONFIRM=redator bash scripts/restore-postgres.sh backups/redator-ARQUIVO.dump
```

O primeiro deploy ainda não possui imagem anterior e, portanto, não oferece
rollback de container. Guarde os diretórios `backups/` e `.deploy/` com acesso
restrito e replique os backups de forma criptografada para fora da VPS.
