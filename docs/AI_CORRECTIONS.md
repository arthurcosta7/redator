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

Medição em 14/09/2026, serializando o schema de forma compacta: prefixo ENEM
11.724 caracteres, prefixo vestibular 13.683 e schema compartilhado 3.869. A
confirmação real, entretanto, deve vir de `cached_input_tokens`: tamanho em
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
- tokens de entrada sem cache, cache hit, cache write, saída e total;
- proporção cacheada, duração e custo estimado em USD.

Os custos devem ser lidos separadamente:

- **cache miss**: tokens de entrada cobrados pela tarifa integral;
- **cache hit**: `cached_input_tokens` cobrados pela tarifa reduzida;
- **cache write**: tokens informados como escrita multiplicados por `OPENAI_CACHE_WRITE_MULTIPLIER`;
- **saída**: tokens gerados cobrados pela tarifa de output.

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
economia. Pelas medidas acima, ENEM + schema somam 15.593 caracteres e
vestibular + schema, 17.552; o número exato de tokens depende da contagem do modelo. Substitua a
ilustração por médias reais após 100–500 correções de staging, segmentadas por
versão do prompt.

Alertas recomendados:

- `cache_hit_ratio < 0,30` por 30 minutos com volume suficiente;
- custo médio por correção 25% acima da referência de sete dias;
- crescimento de `output_tokens`, respostas inválidas ou retries;
- p95 de duração acima do SLO e fila acumulando.

## Modelos de avaliação

### Geração dos simulados

Os simulados usam a busca web da Responses API, restrita a domínios de órgãos
públicos, universidades, organismos internacionais e repositórios acadêmicos.
Cada proposta contém quatro textos motivadores autorais, cada um associado à
fonte consultada. Citações extensas são proibidas; dados, datas e referências
precisam corresponder à página informada.

Cada lote usa uma chamada à Responses API. O provedor pode executar uma ou mais
buscas dentro dela; o backend conta os itens `web_search_call` retornados e
registra `responses_api_calls=1` e `web_search_calls=N`. Custos de busca web não
entram em `corrections.estimated_cost_usd`.

## Custos externos separados

- **Tokens de correção:** persistidos em `corrections` com custo estimado.
- **OCR:** cada invocação registra provedor, quantidade de chamadas, duração e
  quantidade de caracteres extraídos, sem imagem ou texto. O custo financeiro é
  conciliado separadamente no provedor de OCR.
- **Busca web de simulados:** chamada de Responses e quantidade de buscas ficam
  no evento `simulados_gerados`; a cobrança é conciliada separadamente.

O lote contém três propostas para manter quatro materiais densos por simulado
dentro do limite de saída. O pool Redis usa uma versão no nome da chave; mudar o
formato deve incrementar essa versão para impedir que propostas antigas
continuem sendo servidas durante o TTL de sete dias.

- ENEM: problema brasileiro bem recortado, perspectivas complementares,
  dissertação argumentativa e intervenção respeitando direitos humanos.
- Vestibular tradicional: questão conceitual aberta, posições em tensão,
  diálogo crítico com a coletânea e sem obrigação de intervenção.

Referências de formato: [Cartilha da Redação do ENEM 2025](https://www.gov.br/inep/pt-br/centrais-de-conteudo/acervo-linha-editorial/publicacoes-institucionais/avaliacoes-e-exames-da-educacao-basica/redacao-do-enem-2025-cartilha-do-a-participante/),
[diretrizes da prova de redação FUVEST](https://www.fuvest.br/simulado-redacao/),
[princípios da redação Unicamp](https://www2.unicamp.br/unicamp/noticias/2024/12/01/segunda-fase-do-vestibular-da-unicamp-2025-registra-menor-abstencao-em-15-anos/)
e [acervo do Vestibular Unesp](https://www.vunesp.com.br/VNSP2504).

O fluxo ENEM segue a matriz de cinco competências e a escala discreta de 0,
40, 80, 120, 160 ou 200 pontos. A rubrica separa norma formal, atendimento ao
tema e repertório, projeto argumentativo, coesão e proposta de intervenção para
evitar dupla penalização. Ela também distingue nota zero global de nota zero na
Competência 5: proposta que viole direitos humanos não elimina automaticamente
a redação inteira.

Como a entrada pode ser digitada ou extraída por OCR, o agente não pode inferir
com segurança número de linhas manuscritas, rasuras, identificação ou
legibilidade. Nesses casos, a correção deve registrar a limitação em vez de
inventar uma causa de anulação. Sem tema informado, também não se diagnostica
fuga ou tangenciamento.

Base normativa: [Matrizes de Referência do ENEM 2026](https://www.gov.br/inep/pt-br/centrais-de-conteudo/acervo-linha-editorial/publicacoes-institucionais/avaliacoes-e-exames-da-educacao-basica/matrizes-de-referencia-enem),
[Cartilha do Participante 2025](https://www.gov.br/inep/pt-br/centrais-de-conteudo/acervo-linha-editorial/publicacoes-institucionais/avaliacoes-e-exames-da-educacao-basica/redacao-do-enem-2025-cartilha-do-participante)
e [documentos oficiais da redação do ENEM](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/outros-documentos).
O resultado do sistema é uma estimativa pedagógica; não substitui a correção
oficial realizada segundo o procedimento do Inep.

O fluxo de vestibular v4 usa uma rubrica pedagógica normalizada em quatro
critérios de 25 pontos: adequação à proposta/tema/gênero; autoria, coletânea e
desenvolvimento; composição, progressão e coesão; modalidade escrita, registro
e expressividade. A escala total de 0 a 100 pertence ao produto e não deve ser
apresentada como nota oficial de qualquer instituição.

A proposta completa sempre prevalece. FUVEST e Unicamp podem solicitar gêneros
e situações comunicativas diferentes da dissertação tradicional; primeira
pessoa, marcas de oralidade, estrutura e registro precisam ser avaliados em
função do gênero. Quando apenas um tema curto é informado, o sistema assume uma
dissertação argumentativa como convenção pedagógica e explicita essa limitação.
Ele não exige proposta de intervenção do ENEM.

Referências: [Guia de Provas FUVEST 2026](https://www.fuvest.br/wp-content/uploads/fuvest2026_guia-provas.pdf),
[Resolução do Vestibular Unicamp 2026](https://www.pg.unicamp.br/norma/32142/1)
e [Manual do Vestibular Unesp 2026](https://documento.vunesp.com.br/documento/stream/NzI0MDI2OA==).

Alterar prompt, schema de saída, modelo ou pós-processamento é uma mudança de
comportamento e exige regressão com um conjunto estável de redações.

### Feedback pedagógico detalhado (prompt v4)

Além da nota, cada competência registra um diagnóstico, acertos e melhorias
específicas. Nos planos com insights completos, a resposta também contém:

- ponto forte com título, evidência literal, explicação e estratégia de repetição;
- prioridade de melhoria com evidência, impacto na nota, método de revisão,
  exemplo de reescrita e exercício recomendado;
- checklist de duas a seis verificações para a próxima redação.

O modelo não deve inventar evidências. Quando não houver um acerto defensável,
a lista correspondente pode ficar vazia. Correções anteriores, que armazenavam
listas de strings, continuam válidas e são exibidas no formato legado.

O aluno acessa a correção conforme os recursos do próprio plano. O professor
recebe a análise completa somente quando a redação foi entregue em uma tarefa
de uma turma que lhe pertence e o aluno continua membro ativo. Redações avulsas,
entregas de outro professor e UUIDs inexistentes retornam a mesma resposta 404,
evitando enumeração e acesso indevido por referência direta (IDOR).

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
