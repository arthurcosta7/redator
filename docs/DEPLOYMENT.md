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
3. Crie `backend/.env` e o `.env` da raiz com `POSTGRES_PASSWORD` e `REDIS_PASSWORD` fortes.
4. Configure URLs internas Docker em Compose; configure externamente `FRONTEND_URL=https://redator.online` e `ALLOWED_ORIGINS=["https://redator.online","https://www.redator.online"]`.
5. Copie `nginx/redator.conf`, ajuste domínios e emita certificados.
6. Execute `./deploy.sh` ou os comandos manuais abaixo.

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
3. Cadastre `NEXT_PUBLIC_API_URL=https://api.redator.online`, chave publicável Stripe e nome da aplicação.
4. Publique primeiro em Preview, faça smoke test e depois promova para Production.

## Provedores

- Stripe: configure os quatro Price IDs e webhook para `https://api.redator.online/api/v1/webhooks/stripe`; copie o signing secret.
- Resend: valide o domínio remetente.
- Google Vision: monte/forneça a credencial somente ao backend que executa OCR.
- OpenAI: use projeto, limites de gasto e chave próprios do ambiente.

## Verificação pós-deploy

- HTTPS e redirects corretos; Swagger/OpenAPI indisponíveis em produção.
- CORS aceita somente domínios previstos e cookies chegam com atributos seguros.
- Cadastro/verificação/login/logout funcionam.
- Redação de teste conclui via fila e aparece no histórico.
- Webhook atualiza assinatura no modo de teste.
- Logs não contêm senha, token, cookie ou texto integral.

Para rollback, consulte [Operações](OPERATIONS.md). Nunca faça rollback de aplicação incompatível com uma migration já aplicada.
