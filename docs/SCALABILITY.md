# Escalabilidade e resistência a esgotamento de recursos

## Arquitetura aplicada

- A API persiste a redação e responde rapidamente; correções são executadas em um worker ARQ separado.
- O worker limita a concorrência cara e usa IDs de job únicos. O banco mantém `corrections.essay_id`
  como único, dando uma segunda barreira contra duplicação.
- Cotas diárias e janelas de rate limit são atômicas no Redis (Lua), evitando ultrapassagem por corrida.
- Banco, Redis, OpenAI e OCR têm pools/concorrência/timeouts explícitos.
- Upload é lido até `limite + 1`, validado em thread e OCR síncrono não bloqueia o event loop.
- O pool de simulados usa lock distribuído para impedir múltiplas gerações quando fica vazio.
- Nginx limita corpo, rajadas, conexões e clientes lentos; Uvicorn limita concorrência e backlog.
- `/health` é liveness barato. `/ready` verifica PostgreSQL e Redis para retirar instâncias degradadas.
- Sucessos no log de acesso são amostrados (5% por padrão); erros e respostas lentas continuam integrais,
  evitando que I/O de log vire o gargalo durante picos.

## Dimensionamento inicial

O compose inicia 2 processos web. Cada processo e o worker podem abrir no máximo
`DATABASE_POOL_SIZE + DATABASE_MAX_OVERFLOW` conexões. Com os padrões 5 + 5, o teto nominal
é 30 conexões (20 web + 10 worker), além de migrações/administrativas. Ajuste com base no
`max_connections` real do PostgreSQL, sempre mantendo reserva operacional.

O worker inicia com duas correções simultâneas. Esta é uma proteção de custo e estabilidade,
não uma capacidade final. Escale workers horizontalmente somente depois de medir a latência da
OpenAI, a idade da fila, o orçamento e os limites da conta.

## Matriz de testes antes de produção

1. Baseline e carga esperada: p50/p95/p99 e uso de recursos.
2. Stress: subir usuários até o primeiro SLO violado, sem aumentar tudo ao mesmo tempo.
3. Spike: entrada abrupta; deve haver 429/503 controlado, não crash ou fila perdida.
4. Soak: duas horas ou mais para detectar vazamento de memória/conexões.
5. Recuperação: reiniciar web, worker e Redis separadamente; jobs devem ser retomados/idempotentes.
6. Abuso: uploads acima do limite, slow body, rajadas por usuário/IP e muitas chamadas caras.
7. Dependências degradadas: OpenAI lenta/429/5xx, pool PostgreSQL saturado e Redis indisponível.

Capacidade só é válida para a mesma VPS, banco, latência de rede, dados e versão testados. Guarde
CSV, métricas e commit de cada execução para comparar regressões.

## Baseline local observado em 18/08/2026

Ambiente Windows local, um processo Uvicorn, PostgreSQL e Redis em Docker, sem Nginx e sem IA:

- 100 usuários em liveness/readiness por 30 s: 6.027 requisições, 0 falhas, 204,7 req/s,
  p95 11 ms e máximo 101 ms.
- 75 usuários autenticados em leituras reais por 30 s: 1.641 requisições, 0 falhas,
  55,6 req/s, p95 120 ms e máximo 358 ms.
- Pico imediato de 300 usuários sobre um processo limitado a 200 operações concorrentes:
  9.410 requisições em 15 s, 6.263 atendidas e 3.147 recusadas com 503 controlado (33,44%).
  Após o pico, `/health` e `/ready` voltaram imediatamente a 200. O limite protegeu memória e
  conexões; o `log-level` de produção evita amplificação de logs para cada rejeição esperada.
- Redis real: 200 reservas simultâneas respeitaram exatamente a cota 7; 200 tentativas na
  janela respeitaram exatamente o limite 25.

Esses números comprovam regressão e funcionamento local; não representam capacidade da VPS.

## Revalidação do container de produção em 08/09/2026

Após filesystem somente-leitura, remoção de capabilities e atualização da imagem,
um smoke público com 50 usuários por 30 segundos executou 2.969 requisições, sem
falhas, a 101,14 req/s. O p95 global foi 13 ms e o máximo 312 ms. O cenário
incluiu `/health` e `/ready`, portanto exercitou também PostgreSQL e Redis.

O roteiro Locust agora só instancia perfis autenticados quando
`LOAD_TEST_ACCESS_TOKEN` está definido, e só habilita escrita quando também há
`LOAD_TEST_ALLOW_WRITES=1`. Essa medição local valida regressão; a decisão final
de capacidade ainda depende do mesmo teste na VPS de staging com métricas de
CPU, memória, banco, Redis e fila.
