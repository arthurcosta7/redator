# API HTTP

Base local: `http://localhost:8000/api/v1`. O cliente usa JSON, exceto upload de foto (`multipart/form-data`). Autenticação usa cookies HttpOnly de acesso e refresh; chamadas do navegador devem enviar credenciais.

## Convenções

- `401`: sessão ausente ou inválida.
- `403`: conta não verificada/inativa, plano ou papel insuficiente.
- `404`: recurso inexistente ou fora do escopo do usuário.
- `409`: conflito de estado ou unicidade.
- `422`: entrada inválida, com `detail` e lista `errors` quando aplicável.
- `429`: limite de frequência ou cota atingida.
- `500`: erro interno com `request_id`, sem traceback.

Paginação usa `page` e `per_page` onde disponível. O Swagger de desenvolvimento é a referência de schemas e campos.

## Sistema

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Processo está vivo |
| GET | `/ready` | Banco e Redis estão disponíveis |

## Autenticação — `/auth`

| Método | Rota |
|---|---|
| POST | `/register/student` |
| POST | `/register/teacher` |
| POST | `/login` |
| POST | `/refresh` |
| POST | `/logout` |
| GET | `/verify-email/{token}` |
| POST | `/resend-verification` |
| POST | `/forgot-password` |
| POST | `/reset-password` |

Respostas de recuperação e reenvio são deliberadamente genéricas para não revelar se um email existe.

## Redações — `/essays`

| Método | Rota | Observação |
|---|---|---|
| POST | `/essays` | Texto; retorna estado pendente |
| POST | `/essays/photo` | Foto JPEG/PNG/WebP + OCR |
| GET | `/essays/daily-limit` | Uso e limite do dia |
| GET | `/essays` | Histórico paginado |
| GET | `/essays/{essay_id}` | Detalhe e correção quando pronta |
| DELETE | `/essays/{essay_id}` | Exclui recurso do próprio usuário |

Exemplo de submissão:

```json
{
  "theme": "Desafios da educação midiática no Brasil",
  "title": "Informação e cidadania",
  "content": "Texto da redação...",
  "essay_type": "enem",
  "assignment_id": null
}
```

## Usuário, assinatura e recursos

| Grupo | Endpoints |
|---|---|
| Perfil | `GET/PATCH/DELETE /users/me` |
| Stripe | `POST /checkout/session`, `POST /checkout/portal`, `GET /subscription`, `POST /webhooks/stripe` |
| Insights | `GET /insights/summary` |
| Simulados | `GET /simulados/new` |

Webhook Stripe é público apenas no sentido de não usar sessão: sua assinatura é obrigatoriamente verificada.

## Professor — `/professor`

- Turmas: listar, criar, detalhar, editar e excluir em `/turmas`; gerenciar membros, convites e redações nas subrotas.
- Aluno: `/meus-convites`, aceitar/remover convite e `/minhas-turmas`.
- Capacidade: `GET /slots`.
- Analytics: `GET /analytics`, `/analytics/turma/{turma_id}` e `/analytics/aluno/{member_id}`.
- Tarefas: criar/listar por turma; detalhar, editar, excluir, fechar, reabrir, comentar submissão e consultar insights.
- Geração de tema: `POST /tarefas/gerar-tema`.

## Contestações — `/appeals`

| Método | Rota | Papel |
|---|---|---|
| POST | `/appeals` | Aluno dono da correção |
| GET | `/appeals/mine` | Aluno |
| GET | `/appeals/review-queue` | Licenciado ou superadmin |
| POST | `/appeals/{id}/claim` | Licenciado ou superadmin |
| GET | `/appeals/{id}` | Participante autorizado |
| POST | `/appeals/{id}/resolve` | Revisor responsável/superadmin |
| GET | `/appeals/improvement-dataset` | Superadmin |

Uma decisão `corrected` exige nova nota; `upheld` não aceita alteração. Toda decisão exige explicação humana.

## Administração — `/admin`

- Métricas: `GET /stats`, `GET /analytics`.
- Usuários: listar/detalhar/editar/excluir em `/users`.
- Redações: `GET /essays`.
- Equipe: listar, convidar, alterar papel e remover em `/team`.

A matriz exata está em [Papéis e permissões](ROLES_AND_PERMISSIONS.md).
