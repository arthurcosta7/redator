# Operações

## Saúde e observabilidade

- `/health`: liveness; confirma que o processo responde.
- `/ready`: readiness; confirma PostgreSQL e Redis.
- Docker: `docker compose -f docker-compose.prod.yml ps`.
- Logs: use `request_id` para correlacionar falhas entre respostas e backend.

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 backend
docker compose -f docker-compose.prod.yml logs --tail=200 correction_worker
docker compose -f docker-compose.prod.yml logs --tail=100 postgres redis
```

Alertas mínimos: indisponibilidade, erro 5xx, latência p95, 429 anormal, pool de banco, memória Redis, tamanho/idade da fila, jobs falhos, custo/tokens OpenAI, falha de webhook e espaço em disco.

## Runbook: correções paradas

1. Confirme `/ready` e o estado do `correction_worker`.
2. Examine logs do worker pelo ID da redação/request.
3. Verifique conectividade Redis, OpenAI e banco.
4. Diferencie backlog saudável de jobs falhando repetidamente.
5. Corrija a causa antes de escalar concorrência; preserve idempotência.
6. Confirme que novos jobs e um job pendente completam.

## Runbook: API indisponível

1. Teste `localhost:8000/health` na VPS para separar Nginx de API.
2. Consulte `docker compose ps` e logs.
3. Teste `/ready`; se falhar, investigue PostgreSQL e Redis.
4. Verifique memória, CPU, disco, certificados e configuração recente.
5. Reinicie apenas o serviço afetado após capturar evidências.

## Backup e recuperação

- Automatize backup criptografado do PostgreSQL para destino fora da VPS.
- Proteja o volume/AOF Redis, mas trate PostgreSQL como fonte de verdade de negócio.
- Teste restauração periodicamente e registre RPO/RTO alcançados.
- Faça backup antes de migrations e mantenha versão de imagem anterior.

## Deploy e rollback

Antes do deploy, registre commit/imagem, backup e migration atual. Se a aplicação falhar e o schema for compatível, volte à imagem anterior e reinicie API e worker juntos. Se houver incompatibilidade de schema, siga um plano específico revisado; não improvise downgrade com dados reais.

## Manutenção

- Renovação TLS e validade de DNS.
- Rotação de segredos e revisão de acessos.
- Atualização de dependências e imagens após testes.
- Limpeza/retensão de logs sem apagar evidências necessárias.
- Revisão de custos, filas, limites de plano e capacidade conforme [Escalabilidade](SCALABILITY.md).
