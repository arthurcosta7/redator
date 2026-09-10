# IA, OCR e correções

## Seleção de modelo

- Correções: `OPENAI_CORRECTION_MODEL` (padrão `gpt-5.6-luna`).
- Geração de simulados e temas: `OPENAI_FREE_MODEL`.
- `OPENAI_PAID_MODEL` permanece disponível para fluxos premium que não são correção.

Um modelo único nas correções aumenta a chance de reaproveitar o mesmo prefixo e
torna a comparação de custo e qualidade mais limpa. Os nomes continuam sendo
configuração de implantação: confirme disponibilidade, preço e compatibilidade
na conta OpenAI antes do deploy.

## Pipeline

1. Pydantic valida tema, tipo, tamanho e conteúdo.
2. Uploads têm tamanho, MIME, assinatura real e dimensões verificados.
3. Google Vision extrai texto quando a entrada é foto, sob timeout e limite de concorrência.
4. A API grava a redação como `pending` e enfileira um job.
5. O worker muda para `processing`, chama a OpenAI Responses API e exige Structured Outputs com JSON Schema estrito.
6. Correção e estado final são persistidos na mesma fronteira transacional aplicável.
7. Apenas falhas transitórias de conexão, timeout, rate limit ou servidor sofrem retry limitado; schema inválido e erros permanentes não geram nova chamada paga.

Prompts ficam em `backend/app/services/ai/prompts/`. Texto do aluno é dado não confiável: instruções contidas na redação não podem substituir o rubric ou induzir exposição de segredos.

A requisição HTTP apenas enfileira o trabalho. Fechar o navegador não cancela o
job; e cancelar um job depois que a chamada chegou à OpenAI não garante que o
provedor deixará de processá-la ou cobrá-la. A deduplicação por ID da redação,
o status no banco, o lock transacional e a unicidade de `Correction.essay_id`
protegem contra duplo clique e reprocessamento local.

## Prompt Caching

A Responses API habilita Prompt Caching automaticamente para modelos
compatíveis. O Redator organiza a requisição para aproveitar esse mecanismo:

1. rubric ENEM ou vestibular e regras de segurança ficam no primeiro bloco
   `developer`, idêntico entre correções do mesmo tipo;
2. o JSON Schema de saída também é estável;
3. tema e redação aparecem somente no último bloco `user`;
4. `prompt_cache_key` usa
   `essay-correction:<tipo>:<versão>:<modelo>`, sem ID ou dado pessoal;
5. `store=false` impede o armazenamento da resposta para recuperação posterior.

O prefixo ENEM atual tem aproximadamente 4 mil caracteres; junto do schema
estável, a entrada fixa supera com folga o tamanho mínimo esperado para caching.
A confirmação real, entretanto, deve vir de `cached_input_tokens`: tamanho em
caracteres não substitui a contagem feita pelo provedor.

O cache é uma otimização, nunca uma dependência funcional. Cache miss produz a
mesma correção e custo normal. Não existe cache próprio no Redis com redações de
alunos, evitando retenção adicional de conteúdo sensível.

### Versionamento e invalidação

Incremente `ESSAY_CORRECTION_PROMPT_VERSION` ao alterar rubric, regras, schema
ou pós-processamento que mude o comportamento. O tipo, a versão e o modelo
separam as rotas de cache e as métricas. Trocar o texto do prefixo já causa miss
por correspondência exata; a versão explícita também impede misturar relatórios
de comportamentos diferentes.

Evite colocar timestamp, UUID, nome, plano ou qualquer valor variável no bloco
`developer`: uma única diferença quebra o prefixo compartilhado.

## Telemetria de uso e custo

Cada correção persiste, sem texto da redação:

- modelo, versão do prompt e ID da resposta;
- tokens de entrada, cache hit, cache write, saída e total;
- proporção cacheada, duração e custo estimado em USD.

O custo usa `Decimal` e preços configuráveis por milhão de tokens. Os defaults
documentam o GPT-5.6 Luna no momento da implementação: USD 0,20 entrada, USD
0,02 leitura do cache e USD 1,20 saída; escrita de cache usa multiplicador 1,25
quando essa métrica é retornada. Preços mudam: revise as variáveis antes de
fechar orçamento ou fazer deploy.

Consulta operacional de exemplo:

```sql
SELECT
  prompt_version,
  ai_model_used,
  COUNT(*) AS corrections,
  ROUND(AVG(cache_hit_ratio), 4) AS avg_cache_hit_ratio,
  SUM(input_tokens) AS input_tokens,
  SUM(cached_input_tokens) AS cached_input_tokens,
  SUM(output_tokens) AS output_tokens,
  ROUND(AVG(output_tokens), 2) AS avg_output_tokens,
  ROUND(AVG(processing_time_seconds), 2) AS avg_duration_seconds,
  ROUND(AVG(estimated_cost_usd), 8) AS avg_cost_usd,
  ROUND(SUM(estimated_cost_usd), 6) AS estimated_cost_usd
FROM corrections
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY prompt_version, ai_model_used
ORDER BY prompt_version, ai_model_used;
```

### Estimativa ilustrativa antes/depois

Para uma correção com 2.000 tokens de entrada, dos quais 1.300 pertencem ao
prefixo reutilizável, e 1.000 tokens de saída:

| Cenário | Entrada | Saída | Total estimado |
|---|---:|---:|---:|
| Sem cache | USD 0,000400 | USD 0,001200 | USD 0,001600 |
| Cache aquecido | USD 0,000166 | USD 0,001200 | USD 0,001366 |

Nesse exemplo, a parcela de entrada cai cerca de 58,5% e o custo total cerca de
14,6%; a economia é USD 0,000234 por redação e a saída domina a conta:

| Volume | Sem cache | Cache aquecido | Economia |
|---|---:|---:|---:|
| 100 redações | USD 0,1600 | USD 0,1366 | USD 0,0234 |
| 1.000 redações | USD 1,6000 | USD 1,3660 | USD 0,2340 |
| 10.000 redações | USD 16,0000 | USD 13,6600 | USD 2,3400 |

A primeira requisição pode ser cache miss ou cache write e não recebe essa
economia. O prefixo fixo e o schema somam aproximadamente 6,8 mil caracteres,
mas o número exato de tokens depende da contagem do modelo. Substitua a
ilustração por médias reais após 100–500 correções de staging, segmentadas por
versão do prompt.

Alertas recomendados:

- `cache_hit_ratio < 0,30` por 30 minutos com volume suficiente;
- custo médio por correção 25% acima da referência de sete dias;
- crescimento de `output_tokens`, respostas inválidas ou retries;
- p95 de duração acima do SLO e fila acumulando.

## Modelos de avaliação

O fluxo ENEM avalia competências e nota na escala correspondente. O fluxo vestibular usa seu rubric próprio. Alterar prompt, schema de saída, modelo ou pós-processamento é uma mudança de comportamento e exige regressão com um conjunto estável de redações.

## Contestação humana

O aluno explica o motivo em pelo menos 30 caracteres e decide se permite uso anonimizado. Um professor licenciado ou superadmin assume o caso e:

- mantém a correção (`upheld`), explicando a decisão; ou
- corrige (`corrected`), fornecendo nota final, eventuais notas por competência e fundamentação.

A fundamentação tem mínimo de 50 caracteres. O resultado preserva a correção original para auditoria.

## Melhoria contínua segura

O sistema atual não treina modelos automaticamente. Ele disponibiliza a superadmins um dataset desidentificado somente quando há opt-in e decisão humana corrigindo o resultado. O uso recomendado é:

1. exportar para ambiente controlado;
2. remover identificadores residuais e revisar consentimento;
3. separar conjuntos de desenvolvimento e avaliação;
4. medir erro por tipo, competência e faixa de nota;
5. testar alteração de prompt/modelo offline;
6. aprovar, versionar e monitorar antes de produção.

Nunca envie email, nome, IDs internos ou metadados desnecessários ao provedor de IA. Registre modelo e versão lógica do prompt, mas não o texto integral da redação em logs.

## Qualidade e custo

Monitore latência p50/p95, tokens de entrada/saída, cache hit, custo por
correção, taxa de retry, JSON inválido, divergência humana e fila. Limites de
saída e concorrência protegem orçamento; aumentar workers sem verificar rate
limits e orçamento pode piorar erros e custo.
