# Estratégia de testes

Este documento é a entrada principal para qualidade automatizada do Redator. A suíte foi desenhada para proteger autenticação, permissões, correções por IA, contestações humanas, pagamentos, filas, responsividade e acessibilidade sem consumir serviços externos reais.

Documentos relacionados:

- [Catálogo das suítes](TEST_CATALOG.md): o que cada arquivo e cenário protege.
- [Execução, manutenção e diagnóstico](TEST_OPERATIONS.md): comandos, relatórios, mocks, CI e resolução de falhas.
- [Escalabilidade](SCALABILITY.md): arquitetura, capacidade e controles de sobrecarga.
- [`backend/tests/load/README.md`](../backend/tests/load/README.md): roteiro Locust detalhado.

## Pirâmide atual

| Camada | Ferramentas | Quantidade | Objetivo |
|---|---|---:|---|
| Backend unitário/contrato | pytest, pytest-asyncio, HTTPX | 120 aprovados | Regras, segurança, IA, fila, adaptadores e contrato HTTP |
| Integração Redis | pytest + Redis real | 1 opcional | Atomicidade real de cotas e rate limiting |
| Frontend unitário | Vitest, Testing Library, jsdom | 28 aprovados | Componentes, estados, middleware e cliente HTTP |
| E2E | Playwright | 16 aprovados | 8 jornadas em desktop Chromium e Pixel 7 |
| Acessibilidade | Axe + Playwright | 2 execuções | Violações críticas/sérias na landing desktop/mobile |
| Carga | Locust | Sob demanda | Smoke, carga, pico, soak e SLO |

Baseline verificada em 8 de setembro de 2026. As quantidades mudam conforme novos casos são adicionados; os comandos e critérios são a fonte de verdade.

## Matriz de risco

| Risco ou fluxo | Unidade | Contrato/integração | E2E | Carga |
|---|---:|---:|---:|---:|
| Senhas, JWT, cookies e tokens | Sim | Sim | Login simulado | Não |
| Autorização, IDOR e papéis | Sim | Sim | Rota protegida | Não |
| Validação, XSS, injeção e upload | Sim | Sim | Validação de formulário | Não |
| Correção por IA e seleção de modelo | Sim, OpenAI simulada | Fila/worker | Não chama IA real | Escrita desativada por padrão |
| Contestação e revisão humana | Sim | Sim | Componente unitário | Não |
| Stripe, Resend e Google Vision | Adaptadores simulados | Webhook/erros | Não | Não |
| Planos de aluno/professor | Sim | Rotas críticas | Desktop/mobile | Leitura |
| Scroll, responsividade e acessibilidade | Sim | Não | Sim + Axe | Não |
| Cotas, Redis e concorrência | Sim | Redis real opcional | Não | Sim |

## Execução rápida

Na raiz, em PowerShell:

```powershell
# Backend + TypeScript + cobertura frontend + E2E
.\scripts\test-all.ps1

# Ciclo mais rápido, sem abrir navegador
.\scripts\test-all.ps1 -SkipE2E
```

Pré-requisitos e primeira instalação estão em [Execução e manutenção](TEST_OPERATIONS.md#preparação-do-ambiente).

## Critérios automatizados

### Backend

- Todos os testes obrigatórios devem passar.
- `bandit -q -r app` e `pip-audit` não podem encontrar vulnerabilidade sem
  análise e decisão documentadas.
- A integração Redis pode ser ignorada apenas quando `SCALABILITY_REDIS_URL` não estiver definido.
- Cobertura global mínima: 56%.
- O piso é um *coverage ratchet*: pode aumentar, nunca diminuir para acomodar uma mudança.

Cobertura de referência:

| Área | Cobertura observada |
|---|---:|
| Backend global | 56,19% |
| Worker de correções | 100% |
| Email | 100% |
| Stripe | 97% |
| Middleware | 96% |
| Fila ARQ | 86% |

### Frontend

| Métrica | Piso | Referência observada |
|---|---:|---:|
| Statements | 41% | 41,15% |
| Branches | 50% | 50,10% |
| Functions | 43% | 43,31% |
| Lines | 41% | 41,56% |

Além da cobertura, `tsc --noEmit`, o build Next.js e todos os projetos Playwright precisam passar. Cobertura não substitui verificação de comportamento: componentes estáticos podem ter baixa cobertura unitária e ainda serem exercitados no E2E.

## Critério mínimo de release

- `pytest` passa e não reduz o piso de cobertura.
- `npm run type-check`, `npm run test:coverage`, `npm run test:e2e` e `npm run build` passam.
- `npm audit` não apresenta vulnerabilidades conhecidas e a imagem Docker do
  backend é construída no CI.
- O job de migrations aplica `alembic upgrade head` em PostgreSQL 16 vazio.
- Migrações foram testadas em staging com backup e rollback definidos.
- `/health` e `/ready` respondem corretamente.
- API e worker estão ativos; uma correção sintética completa ponta a ponta em staging.
- Cadastro, login, logout, recuperação, redação, contestação, turmas, tarefas e checkout receberam smoke test proporcional à mudança.
- Nenhum teste contém segredo, token de produção, redação real ou dado pessoal.
- Mudanças visuais foram verificadas em móvel, desktop, teclado e movimento reduzido.

## Limites conhecidos

- O backend ainda possui endpoints legados com cobertura baixa, principalmente professor, admin, autenticação, insights e Stripe HTTP. O catálogo indica a prioridade recomendada.
- O frontend E2E usa API simulada para ser determinístico; uma suíte separada de staging deve validar integrações reais antes do lançamento.
- Os testes normais não comprovam disponibilidade ou qualidade atual de OpenAI, Stripe, Resend ou Google Vision.
- Locust não roda em todo pull request porque exige ambiente, métricas e autorização de custo.
- O build passa com avisos legados de lint; novos arquivos de teste precisam passar `ruff check tests` e TypeScript sem erro.

## Regra para mudanças

Toda correção de bug deve incluir um teste que falhe antes da correção. Toda nova rota, permissão, estado de redação, plano, integração ou jornada crítica deve atualizar o [catálogo](TEST_CATALOG.md) no mesmo pull request.
