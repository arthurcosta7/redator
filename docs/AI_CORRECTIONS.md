# IA, OCR e correções

## Seleção de modelo

- Plano Free: `OPENAI_FREE_MODEL` (padrão atual `gpt-5.6-luna`).
- Standard, Pro e tarefas de professor: `OPENAI_PAID_MODEL` (padrão atual `gpt-5.4-mini`).

Os nomes são configuração de implantação. Confirme disponibilidade, preço e compatibilidade na conta OpenAI antes do deploy; não codifique nomes novos diretamente no serviço.

## Pipeline

1. Pydantic valida tema, tipo, tamanho e conteúdo.
2. Uploads têm tamanho, MIME, assinatura real e dimensões verificados.
3. Google Vision extrai texto quando a entrada é foto, sob timeout e limite de concorrência.
4. A API grava a redação como `pending` e enfileira um job.
5. O worker muda para `processing`, chama a OpenAI Responses API e valida a saída estruturada.
6. Correção e estado final são persistidos na mesma fronteira transacional aplicável.
7. Falhas transitórias sofrem retry limitado; falha terminal marca `error`.

Prompts ficam em `backend/app/services/ai/prompts/`. Texto do aluno é dado não confiável: instruções contidas na redação não podem substituir o rubric ou induzir exposição de segredos.

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

Monitore latência p50/p95, tokens de entrada/saída, custo por correção, taxa de retry, JSON inválido, divergência humana e fila. Limites de saída e concorrência protegem orçamento; aumentar workers sem verificar rate limits da OpenAI pode piorar erros e custo.
