# Testes de escalabilidade

Os cenários cobrem carga normal, estresse progressivo, pico, duração e recuperação.
Por padrão, apenas endpoints de leitura são chamados: nenhuma correção e nenhum custo de IA.

## Preparação

```powershell
docker compose up -d
cd backend
$env:LOAD_TEST_ACCESS_TOKEN="TOKEN_DE_STAGING"
```

Use um usuário exclusivo de staging e nunca um token de produção.

## Execuções

```powershell
# Smoke publico: confirma o roteiro sem token e sem escrita
.\.venv\Scripts\locust.exe -f tests/load/locustfile.py --headless -u 10 -r 5 -t 30s --host http://localhost:8000

# Carga: 100 usuários por 10 minutos
.\.venv\Scripts\locust.exe -f tests/load/locustfile.py --headless -u 100 -r 10 -t 10m --host http://localhost:8000 --csv reports/load

# Pico: chegada abrupta de 300 usuários
.\.venv\Scripts\locust.exe -f tests/load/locustfile.py --headless -u 300 -r 100 -t 3m --host http://localhost:8000 --csv reports/spike

# Soak: vazamentos e degradação lenta
.\.venv\Scripts\locust.exe -f tests/load/locustfile.py --headless -u 75 -r 5 -t 2h --host http://localhost:8000 --csv reports/soak
```

Critério inicial automatizado: menos de 1% de falhas e p95 global abaixo de 1 segundo.
Para uma decisão de capacidade, acompanhe também CPU, memória, conexões PostgreSQL,
pool Redis, tamanho/idade da fila ARQ e tempo da correção. Após cada pico, confirme que
`/ready` volta a 200 e que a fila retorna a zero sem jobs perdidos.

## Escritas e IA

O cenário de POST só é habilitado com `LOAD_TEST_ALLOW_WRITES=1`. Isso cria redações e
pode consumir OpenAI. Execute-o apenas em staging, com orçamento e cota definidos. A vazão
esperada de IA é deliberadamente limitada por `CORRECTION_WORKER_MAX_JOBS`; aumentá-la sem
medir custo, rate limits do provedor e conexões de banco é inseguro.

Sem `LOAD_TEST_ACCESS_TOKEN`, somente `PublicTraffic` é instanciado. Com token, o
Locust distribui usuários entre leituras públicas e autenticadas. Escritas exigem
simultaneamente o token e `LOAD_TEST_ALLOW_WRITES=1`.
