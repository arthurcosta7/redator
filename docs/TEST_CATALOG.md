# Catálogo de testes automatizados

Este documento descreve o que cada grupo de testes protege e onde novos casos devem ser adicionados. Para comandos, ambiente e solução de problemas, consulte o [manual de operação](TEST_OPERATIONS.md). Para critérios de qualidade e cobertura, consulte a [estratégia de testes](TESTING.md).

## Backend

Diretório principal: `backend/tests/`.

O `conftest.py` prepara uma aplicação isolada para cada teste, com:

- banco SQLite assíncrono em memória;
- conversão de colunas `JSONB` para `JSON` durante os testes;
- cliente HTTP baseado em ASGI, sem abrir uma porta de rede;
- fixtures para usuários, autenticação e dados recorrentes;
- limpeza do estado entre casos.

O SQLite torna a suíte rápida, mas não reproduz integralmente concorrência, locks, índices e recursos específicos do PostgreSQL. Fluxos críticos de persistência devem também ser validados em ambiente de integração com PostgreSQL.

### Segurança e validação

| Arquivo | Responsabilidade principal |
| --- | --- |
| `test_security.py` | Hash e verificação de senhas, JWT, expiração e tokens de segurança. |
| `test_security_regressions.py` | Regressões de autorização, IDOR, papéis, CORS, TLS, request ID, cookies, logs, mass assignment, valores numéricos inválidos e webhooks. |
| `test_validators.py` | Senhas, e-mails, nomes, HTML, tentativas de injeção, assinaturas de arquivo, imagens e conteúdo enviado pelo usuário. |

Esses testes devem crescer sempre que surgir uma vulnerabilidade, uma nova permissão ou uma nova entrada controlada pelo usuário.

### Correção por IA

| Arquivo | Responsabilidade principal |
| --- | --- |
| `test_ai_services.py` | Integração simulada da Responses API, modelo de correção, persistência de telemetria, respostas válidas e inválidas. |
| `test_ai_cost_and_caching.py` | Estabilidade e isolamento do prefixo, separação de cache por perfil, schemas completo/essencial, cache miss/hit/write, fórmula de custo, ausência de chave e timeout. |
| `test_correction_worker.py` | Idempotência, retry e falha terminal do worker, além da seleção do perfil completo para demonstração/pagos/tarefas e essencial para correções Free posteriores. |

As chamadas aos provedores são simuladas. A suíte padrão não consome créditos
nem depende de serviços externos. A efetividade do cache em produção deve ser
confirmada por `cached_input_tokens`; o teste prova a estrutura da requisição e
a matemática, não o estado interno do provedor.

### Contestação de correção

| Arquivo | Responsabilidade principal |
| --- | --- |
| `test_correction_appeals.py` | Abertura, consulta e julgamento de contestações; transições de estado; permissões de aluno e professor licenciado; atualização de nota e feedback. |

Ao alterar estados ou papéis desse fluxo, acrescente casos permitidos e negados. Verificar somente o caminho autorizado não é suficiente.

### Filas, worker e escalabilidade

| Arquivo | Responsabilidade principal |
| --- | --- |
| `test_job_queue.py` | Enfileiramento, deduplicação, limites e falhas na comunicação com a fila. |
| `test_correction_worker.py` | Execução assíncrona da correção, atualização de estado, repetição e tratamento de erro. |
| `test_scalability.py` | Concorrência, rate limiting, backpressure, timeouts e comportamento degradado. |
| `integration/test_scalability_redis.py` | Comportamento real de operações dependentes de Redis. É opt-in e exige Redis disponível. |

Essa camada também cobre a reserva atômica de créditos mensais, a virada do mês e os tetos de acumulação dos planos pagos.

### Planos, turmas e inteligência de produto

| Arquivo | Responsabilidade principal |
| --- | --- |
| `test_teacher_essay_isolation.py` | Isolamento de redações entre professores, alunos únicos ativos no total da conta e liberação segura de vagas. |
| `test_product_analytics.py` | Lista permitida de eventos, pseudonimização do ator e descarte de texto livre e dados pessoais. |

Os testes em memória verificam regras da aplicação. O teste de integração Redis verifica semântica real de expiração, atomicidade e concorrência.

### Integrações externas

| Arquivo | Responsabilidade principal |
| --- | --- |
| `test_external_services.py` | Contratos dos adaptadores de e-mail, pagamentos e demais provedores; sucessos, recusas, indisponibilidade e payloads inesperados. |

Os mocks devem reproduzir o contrato da biblioteca externa, incluindo tipos e exceções. Um mock permissivo demais pode ocultar incompatibilidades com o SDK real.

### Contrato HTTP

| Arquivo | Responsabilidade principal |
| --- | --- |
| `test_api_contract.py` | Status HTTP, schemas, paginação, autenticação, erros e compatibilidade do contrato público da API. |

Mudanças incompatíveis em campos, códigos de resposta ou formatos precisam ser intencionais e documentadas.

## Frontend — testes unitários e de componentes

Diretório principal: `frontend/tests/unit/`.

| Suíte | O que protege |
| --- | --- |
| `api-client` | Montagem de requisições, autenticação, parsing de resposta e tratamento de falhas. |
| `middleware` | Redirecionamentos, rotas públicas e proteção de páginas por sessão. |
| `navbar` | Links, navegação por âncoras, comportamento responsivo e acessibilidade básica. |
| `pricing` | Alternância e exibição correta dos planos de aluno e professor. |
| `registration-fields` | Campos, validações, mensagens e envio do cadastro. |
| `variable-font-hover` | Interação da navegação animada e comportamento acessível. |
| `highlighted-text` | Renderização de destaques e conteúdo textual. |
| `correction-view` | Exibição da correção, notas, competências e estados da interface. |
| `appeal-panel` | Solicitação e acompanhamento de contestação, estados e permissões visíveis. |

Prefira consultas por papel, nome acessível, rótulo ou texto. Seletores ligados à estrutura CSS tornam os testes frágeis sem representar a experiência real do usuário.

## Frontend — jornadas E2E

Diretório principal: `frontend/tests/e2e/`.

A configuração atual executa nove jornadas em dois projetos — desktop e mobile — totalizando 18 execuções:

1. carregamento e conteúdo essencial da página inicial;
2. navegação pela landing page;
3. apresentação e seleção de preços;
4. proposta, confiança, planos e CTA da página dedicada a professores;
5. acesso e validação do login;
6. acesso e validação do cadastro;
7. carregamento do dashboard simulado;
8. envio e acompanhamento de uma redação com APIs simuladas;
9. verificação automatizada de acessibilidade com Axe.

Os testes E2E validam o produto pelo navegador. Sempre que possível, devem observar o resultado visível ao usuário em vez de detalhes internos do React.

## Testes de carga

Diretório: `backend/tests/load/`.

Os cenários Locust cobrem perfis de uso como:

- navegação e leitura de dados;
- autenticação;
- envio de redação;
- consulta de status da correção;
- picos de requisições concorrentes.

Configuração, metas e exemplos estão no [guia de carga](../backend/tests/load/README.md). Esses testes nunca devem ser apontados para produção sem autorização e limites explícitos.

## Lacunas priorizadas

O catálogo registra o que existe; não implica que todos os fluxos estejam completamente cobertos.

| Prioridade | Cobertura a ampliar |
| --- | --- |
| Alta | Autenticação completa, matriz de permissões professor/admin, jornada real de redação e webhooks de pagamento. |
| Média | Turmas e tarefas, recuperação de senha, E2E autenticado de aluno e jornada de professor. |
| Baixa | Execução E2E adicional em Firefox e WebKit e expansão de testes puramente visuais. |

Ao fechar uma lacuna, atualize este catálogo e os pisos de cobertura somente depois de confirmar estabilidade no CI.
