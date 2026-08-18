# Operação dos testes

Este manual reúne preparação, comandos, relatórios, CI e solução de problemas. A cobertura funcional está descrita no [catálogo](TEST_CATALOG.md), e os critérios de aprovação estão na [estratégia](TESTING.md).

Os exemplos abaixo usam PowerShell e partem da raiz do repositório.

## Preparação do ambiente

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

Use a mesma versão de Python definida pelo projeto e nunca grave segredos reais em arquivos versionados.

### Frontend

```powershell
cd frontend
npm ci
npx playwright install
```

`npm ci` preserva as versões do lockfile. Em CI, instale também as dependências de sistema exigidas pelo Playwright quando o executor não as fornecer.

## Execução rápida

### Backend

```powershell
cd backend
python -m pytest
```

Comandos úteis:

```powershell
# Executar sem medir cobertura durante uma investigação rápida
python -m pytest --no-cov

# Executar um arquivo específico
python -m pytest tests/test_security.py

# Filtrar casos pelo nome
python -m pytest -k "appeal or permission"

# Gerar relatório HTML de cobertura
python -m pytest --cov-report=term-missing --cov-report=html
```

O relatório HTML é criado em `backend/htmlcov/`.

### Integração real com Redis

A suíte Redis é opt-in para que a execução unitária continue determinística. Inicie uma instância isolada, informe a URL por `SCALABILITY_REDIS_URL` e execute:

```powershell
cd backend
$env:SCALABILITY_REDIS_URL = "redis://localhost:6379/15"
python -m pytest tests/integration/test_scalability_redis.py
Remove-Item Env:SCALABILITY_REDIS_URL
```

Não reutilize um banco Redis com dados de desenvolvimento ou produção.

### Frontend unitário

```powershell
cd frontend
npm test
```

Comandos complementares:

```powershell
# Modo interativo
npm run test:watch

# Relatório de cobertura
npm run test:coverage

# Verificação de tipos
npm run type-check

# Build de produção
npm run build
```

Os artefatos de cobertura ficam em `frontend/coverage/`.

### Frontend E2E

```powershell
cd frontend
npm run test:e2e
```

Para depuração visual:

```powershell
npm run test:e2e:ui
```

Os relatórios e evidências ficam em `frontend/playwright-report/` e `frontend/test-results/`. Retentativas podem conter screenshots, vídeos e traces.

Para testar uma implantação já disponível, defina a URL antes da execução:

```powershell
cd frontend
$env:PLAYWRIGHT_BASE_URL = "https://ambiente-de-teste.exemplo"
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Use somente ambientes autorizados e dados sintéticos.

## Testes de carga

Consulte parâmetros e perfis no [README do Locust](../backend/tests/load/README.md). Uma execução local típica parte de `backend/` e informa host, usuários, taxa de subida e duração.

Antes de executar:

1. confirme o ambiente-alvo e a autorização;
2. crie usuários e redações exclusivamente de teste;
3. defina limites de usuários, taxa e duração;
4. monitore API, banco, Redis, fila e worker;
5. interrompa a execução diante de erro persistente ou saturação não planejada;
6. descarte ou anonimize os artefatos gerados.

Não interprete apenas a média. Avalie percentis p95/p99, throughput, taxa de erro, uso de conexões, tamanho da fila e tempo total até a correção.

## Mocks e dados de teste

- Simule serviços na fronteira do adaptador, não a lógica interna que está sendo testada.
- A suíte padrão não deve chamar OpenAI, e-mail, Stripe ou outros provedores reais.
- Use nomes, e-mails, redações e identificadores sintéticos.
- Reproduza formatos, tipos de retorno e exceções reais dos SDKs.
- Restaure timers, variáveis de ambiente, spies e handlers globais após cada caso.
- Em Playwright, registre rotas genéricas antes das específicas quando ambas puderem coincidir; a última rota registrada tem precedência.
- Não coloque chaves, tokens ou respostas pessoais em fixtures, snapshots, screenshots ou traces.

## Como adicionar um teste

1. identifique o risco ou regressão que o caso deve impedir;
2. escolha a camada mais baixa capaz de provar o comportamento;
3. escreva um nome que descreva condição e resultado esperado;
4. prepare somente os dados necessários;
5. execute também o caminho negado, inválido ou indisponível quando aplicável;
6. confirme que o teste falha sem a implementação correspondente;
7. rode a suíte do arquivo e depois a suíte completa da camada;
8. atualize o [catálogo](TEST_CATALOG.md) se uma nova área funcional foi criada.

Para permissões, use uma tabela de papéis e ações. Para validação, cubra valores válidos, limites, conteúdo malformado e payloads extras. Para integrações, cubra sucesso, timeout, recusa, resposta incompleta e repetição segura.

## Pipeline recomendado

| Job | Verificações | Dependências |
| --- | --- | --- |
| `backend-tests` | Pytest, cobertura e análise dos relatórios. | Python e dependências de desenvolvimento. |
| `frontend-unit` | Testes unitários, cobertura, tipos e build. | Node e instalação via lockfile. |
| `frontend-e2e` | Jornadas desktop/mobile e Axe. | Navegadores Playwright e aplicação iniciada. |
| `redis-integration` | Casos reais de concorrência e expiração. | Serviço Redis isolado. |
| `load-smoke` | Carga curta e controlada em ambiente de teste. | Ambiente implantado e autorização explícita. |

Os três primeiros jobs devem bloquear o merge. Integração Redis e carga podem ser jobs separados, mas precisam ser obrigatórios antes de releases que alterem fila, rate limiting, cache ou processamento assíncrono.

## Interpretação de falhas

- **Falha funcional:** reproduza o arquivo isoladamente e preserve o caso como regressão.
- **Flakiness:** procure dependência de tempo, ordem, estado global, rede ou animação; não resolva apenas aumentando retentativas.
- **Cobertura abaixo do piso:** localize linhas não exercitadas e acrescente casos relevantes, sem testes artificiais feitos apenas para elevar o número.
- **E2E somente no mobile ou desktop:** revise layout, elemento encoberto, breakpoint, scroll e tamanho da área clicável.
- **Timeout:** diferencie espera incorreta do teste, lentidão da aplicação e indisponibilidade externa.
- **Snapshot ou visual alterado:** confirme se a mudança é intencional antes de atualizar a referência.

## Solução de problemas

### O backend não encontra módulos

Ative o ambiente virtual e reinstale o projeto com as dependências de desenvolvimento:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

### O Playwright não encontra o navegador

```powershell
cd frontend
npx playwright install
```

### A porta do frontend já está ocupada

Encerre o processo de desenvolvimento existente ou use `PLAYWRIGHT_BASE_URL` para apontar os testes ao servidor correto.

### Um teste Redis foi ignorado

Isso é esperado sem `SCALABILITY_REDIS_URL` e uma instância Redis isolada disponível.

### O teste passa isolado e falha na suíte

Procure estado compartilhado: variáveis de ambiente, banco, cache, mocks, timers, handlers de rede ou objetos mutáveis que não foram restaurados.

## Evidência de aprovação

Ao registrar uma execução, informe:

- commit testado;
- ambiente e versões relevantes;
- comandos executados;
- totais aprovados, falhos, ignorados e instáveis;
- cobertura por camada;
- relatório E2E e traces de falhas;
- métricas de carga, quando aplicável;
- riscos aceitos e testes não executados.

Não versionar os artefatos gerados. Eles devem ser publicados pelo CI com retenção limitada e acesso compatível com a sensibilidade dos dados.
