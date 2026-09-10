# Produto e regras de negócio

O Redator é uma plataforma de prática de redação com correção assistida por IA. Aceita texto digitado ou fotografia, avalia nos modelos ENEM e vestibular, organiza tarefas entre professores e alunos e permite contestar uma correção para revisão humana.

## Públicos e jornadas

### Aluno

1. Cria e verifica a conta.
2. Envia uma redação própria ou uma tarefa de turma.
3. A API valida o conteúdo, reserva a cota quando aplicável e enfileira a correção.
4. O dashboard acompanha `pending`/`processing` até `completed` ou `error`.
5. O aluno consulta notas, competências, destaques e insights.
6. Se necessário, abre uma única contestação por correção e pode autorizar uso anonimizado para melhoria.

### Professor

Cria turmas, convida alunos, publica tarefas e temas, acompanha submissões e consulta análises por turma ou estudante. Redações entregues como tarefa não consomem a cota diária do aluno.

O professor gratuito pode manter até 3 alunos ativos por turma. Quando possui pacote, `teacher_student_slots` passa a limitar o total de alunos ativos somado entre todas as turmas; o Price ID do pacote é configurado por `STRIPE_PRICE_TEACHER_PACKAGE`. Insights agregados por tarefa exigem pacote ativo.

### Equipe interna

Perfis administrativos acompanham usuários, redações, métricas e suporte. Professores licenciados revisam contestações, mas não recebem acesso ao restante do painel administrativo.

## Planos de aluno

Os limites são configuráveis por ambiente; os padrões atuais são:

| Plano | Correções próprias/dia | Modelo de IA | Recursos adicionais |
|---|---:|---|---|
| Free | 1 | `OPENAI_CORRECTION_MODEL` | Correção essencial |
| Standard | 3 | `OPENAI_CORRECTION_MODEL` | Insights e simulados |
| Pro | 10 | `OPENAI_CORRECTION_MODEL` | Insights e simulados |

O modelo único de correção maximiza o prefixo compartilhado e pode ser trocado
centralmente. O limite Pro não é ilimitado no backend. Tarefas enviadas por uma
turma ficam fora dessa cota. Benefícios e preços comerciais devem permanecer
sincronizados entre configuração, Stripe, landing page e dashboard.

## Estados importantes

- Redação: `pending`, `processing`, `completed`, `error`.
- Contestação: `pending`, `in_review`, `upheld` (correção mantida), `corrected` (nota alterada).
- Membro de turma: `pending`, `active`, `removed`.
- Assinatura: `active`, `cancelled`, `past_due`, `trialing`, `incomplete`.

## Invariantes

- Uma redação possui no máximo uma correção.
- Uma correção possui no máximo uma contestação.
- Um aluno entrega cada tarefa no máximo uma vez.
- Apenas o dono acessa ou exclui sua redação, exceto nos fluxos autorizados de professor/admin/revisor.
- A nota só é alterada por uma decisão humana `corrected`, com fundamentação.
- Dados autorizados para melhoria são exportados de forma desidentificada; não existe fine-tuning automático em produção.
