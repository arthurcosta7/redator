# IA, OCR e correções

## Seleção de modelo

- Correções pessoais Free: `OPENAI_FREE_MODEL` (padrão `gpt-5.6-luna`).
- Correções pessoais Standard/Pro: `OPENAI_PAID_MODEL` (padrão `gpt-5.4-mini`).
- Redações vinculadas a tarefas: `OPENAI_PAID_MODEL`, pois o custo pertence à operação do professor.
- Geração de simulados e temas: `OPENAI_FREE_MODEL`.
- `OPENAI_CORRECTION_MODEL` é mantido temporariamente para compatibilidade e medições legadas; o roteamento de produção usa as variáveis por plano.

Os nomes são configuração de implantação: confirme disponibilidade, preço e
compatibilidade na conta OpenAI antes do deploy. Métricas de qualidade devem ser
separadas por modelo, versão do prompt, tipo de redação e origem da entrada.

## Pipeline

1. Pydantic valida tema, tipo, tamanho e conteúdo.
2. Uploads têm tamanho, MIME, assinatura real e dimensões verificados.
3. Google Cloud Vision `DOCUMENT_TEXT_DETECTION` extrai texto quando a entrada é foto. Não há fallback de qualidade inferior: credencial ausente ou indisponibilidade retorna erro temporário e devolve o crédito reservado.
4. O aluno revisa e pode corrigir a transcrição antes de autorizar a avaliação; artefatos de OCR não devem ser tratados automaticamente como erros autorais.
5. A API grava a redação confirmada como `pending` e enfileira um job.
6. O worker muda para `processing`, chama a OpenAI Responses API e exige Structured Outputs com JSON Schema estrito.
7. Correção e estado final são persistidos na mesma fronteira transacional aplicável.
8. Apenas falhas transitórias de conexão, timeout, rate limit ou servidor sofrem retry limitado; schema inválido e erros permanentes não geram nova chamada paga.

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
   `essay-correction:<tipo>:<versão>:<modelo>:<perfil>`, sem ID ou dado pessoal;
5. `store=false` impede o armazenamento da resposta para recuperação posterior.

Nos modelos GPT-5.6 ou superiores, o último bloco estável também recebe um
breakpoint explícito com TTL de 30 minutos. O GPT-5.4 mantém o cache implícito,
pois não recebe opções que não estejam documentadas para esse modelo.

Medição em 14/09/2026, serializando os schemas sem espaços: o prefixo ENEM tem
13.184 caracteres no perfil completo e 13.103 no essencial; o de vestibular,
14.207 e 14.126. Os schemas têm, respectivamente, 3.867 e 2.084 caracteres. A
confirmação real deve vir de `cached_input_tokens`: tamanho em caracteres não
substitui a contagem feita pelo provedor.

O cache é uma otimização, nunca uma dependência funcional. Cache miss produz a
mesma correção e custo normal. Não existe cache próprio no Redis com redações de
alunos, evitando retenção adicional de conteúdo sensível.

### Versionamento e invalidação

Incremente `ESSAY_CORRECTION_PROMPT_VERSION` ao alterar rubric, regras, schema
ou pós-processamento que mude o comportamento. O tipo, a versão, o modelo e o
perfil separam as rotas de cache. Trocar o texto do prefixo já causa miss
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
economia. O número exato de tokens depende da contagem do modelo. Substitua a
ilustração por médias reais após 100–500 correções de staging, segmentadas por
versão do prompt, modelo e perfil de resposta registrado nos logs.

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
- **OCR:** cada invocação do Google Cloud Vision registra quantidade de chamadas,
  duração, sucesso/falha e quantidade de caracteres extraídos, sem imagem ou
  texto. O custo financeiro é conciliado separadamente no Google Cloud.
- **Busca web de simulados:** chamada de Responses e quantidade de buscas ficam
  no evento `simulados_gerados`; a cobrança é conciliada separadamente.

### Preço do OCR Google Cloud Vision

Valor consultado em 15/09/2026 na tabela oficial do Cloud Vision para
`DOCUMENT_TEXT_DETECTION`: cada imagem é uma unidade; as primeiras 1.000 unidades
do mês são gratuitas, de 1.001 a 5.000.000 custam US$ 1,50 por 1.000 e, acima
disso, US$ 0,60 por 1.000. O bloco final é proporcional. Portanto, após a
franquia, uma foto custa US$ 0,0015. Confira a
[tabela oficial](https://cloud.google.com/vision/pricing) antes de fechar o
orçamento, pois câmbio, tributos e preços podem mudar.

O upload envia uma imagem diretamente em memória e solicita somente
`DOCUMENT_TEXT_DETECTION`. Repetir a extração é uma nova unidade faturável. O
rate limit e a cota mensal de leituras de foto limitam abuso e denial of wallet.

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

Após a extração, o backend emite um comprovante opaco de revisão, vinculado ao
usuário e ao modelo de redação e válido por duas horas. Somente esse comprovante
permite persistir `input_type=photo`; declarar a origem no payload não concede
tolerância de OCR. O prompt v6 recebe a origem verificada. Para fotos, ocorrências
isoladas plausíveis de reconhecimento não são automaticamente atribuídas ao
autor, sobretudo na C1; erros inequívocos ou recorrentes continuam contando.
Na C3 e C4, a faixa é determinada pelo desempenho predominante, e uma falha
localizada não derruba sozinha um texto globalmente organizado e coeso.

Base normativa: [Matrizes de Referência do ENEM 2026](https://www.gov.br/inep/pt-br/centrais-de-conteudo/acervo-linha-editorial/publicacoes-institucionais/avaliacoes-e-exames-da-educacao-basica/matrizes-de-referencia-enem),
[Cartilha do Participante 2025](https://www.gov.br/inep/pt-br/centrais-de-conteudo/acervo-linha-editorial/publicacoes-institucionais/avaliacoes-e-exames-da-educacao-basica/redacao-do-enem-2025-cartilha-do-participante)
e [documentos oficiais da redação do ENEM](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/outros-documentos).
O resultado do sistema é uma estimativa pedagógica; não substitui a correção
oficial realizada segundo o procedimento do Inep.

O fluxo de vestibular v6 usa uma rubrica pedagógica normalizada em quatro
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

### Perfis de resposta e feedback pedagógico (prompt v6)

A primeira correção pessoal Free usa o perfil completo para demonstrar a
experiência. As correções pessoais Free seguintes usam o perfil essencial:
mantêm a mesma rubrica, pontuação por competência, feedback geral e até três
grifes, mas não geram blocos detalhados que a interface básica ocultaria.
Standard, Pro e redações enviadas por tarefa sempre usam o perfil completo.

O perfil é decidido no worker a partir do plano, do vínculo com tarefa e da
quantidade de correções pessoais já concluídas. Essa decisão reduz tokens de
saída sem mudar os limites mensais ou consumir créditos adicionais.

Além da nota, cada competência registra um diagnóstico, acertos e melhorias
específicas. Nos planos com insights completos, a resposta também contém:

- ponto forte com título, evidência literal, explicação e estratégia de repetição;
- prioridade de melhoria com evidência, impacto na nota, método de revisão,
  exemplo de reescrita e exercício recomendado;
- checklist de duas a quatro verificações para a próxima redação.

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
