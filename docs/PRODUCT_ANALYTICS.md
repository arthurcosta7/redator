# Métricas de produto e conversão

O Redator usa eventos estruturados próprios no backend. A camada
`product_analytics.py` aceita somente nomes e propriedades em lista positiva;
não existe campo de texto livre. Redações, temas, nomes, emails, escola e outros
dados pessoais não são enviados.

Como segunda barreira, o processador central de logs remove conteúdo textual,
emails, nomes e IPs e pseudonimiza identificadores de usuário com HMAC. Isso
preserva correlação operacional sem gravar o identificador original.

## Funil instrumentado

| Jornada | Eventos |
|---|---|
| Cadastro | `registration_started`, `registration_completed` + `account_type` |
| Primeira experiência | `first_essay_submitted`, `first_correction_completed` |
| Retenção | `second_essay_submitted`, `second_correction_completed` |
| Créditos | `credits_used`, `credit_limit_exceeded` + plano/recurso/uso/limite |
| Conversão | `plans_viewed`, `checkout_started`, `subscription_completed`, `subscription_cancelled` |
| Professor | `class_created`, `invitation_sent`, `student_activated`, `assignment_created`, `assignment_ai_generated`, `assignment_essay_submitted`, `teacher_report_viewed` |

`plans_viewed` é aceito pelos endpoints `POST /users/events` (autenticado) e
`POST /users/events/public` (anônimo, limitado por IP); nenhum recebe payload
livre nem aceita outro evento arbitrário do navegador. Os demais são emitidos em pontos
autoritativos do servidor.

## Operação

Os eventos aparecem no fluxo de logs estruturados com `event=product_event`,
`product_event=<nome>` e
um identificador pseudonimizado por HMAC do ator. Para dashboards de funil é necessário enviar
esses logs a um agregador configurado pela operação. Antes de habilitar um
destino externo, valide retenção, região, controle de acesso e base legal.
