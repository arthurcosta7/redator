# Papéis e permissões

Autorização é validada no backend e os papéis administrativos são relidos do banco a cada requisição; claims antigos do JWT não concedem acesso persistente.

## Identidades de produto

| Tipo | Capacidades principais |
|---|---|
| `student` | Redações próprias, histórico, turmas, tarefas e contestação |
| `teacher` | Turmas, membros, tarefas e analytics sob sua responsabilidade |

## Papéis internos

| Papel | Estatísticas | Analytics | Ver usuários/redações | Alterar usuários | Gerir equipe | Revisar contestação | Dataset |
|---|---:|---:|---:|---:|---:|---:|---:|
| `superadmin` | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| `admin` | Sim | Sim | Sim | Sim | Conforme ação protegida | Não | Não |
| `support` | Sim | Não | Sim | Sim | Não | Não | Não |
| `analyst` | Sim | Sim | Leitura definida pelas rotas | Não | Não | Não | Não |
| `licensed_teacher` | Não | Não | Apenas caso atribuído/autorizado | Não | Não | Sim | Não |

Operações destrutivas e gestão sensível de equipe permanecem restritas ao superadmin. Promoção a superadmin é bloqueada pela API e um superadmin não pode remover a si próprio.

## Regras de escopo

- Um usuário comum só lê/edita seus recursos.
- Um professor só administra turmas de que é professor e alunos vinculados.
- Um aluno só acessa tarefas das turmas ativas em que participa.
- Um revisor licenciado vê a fila elegível e os casos que assumiu; superadmin pode intervir.
- Contestação só pode ser criada pelo aluno dono da correção.
- Dataset de melhoria é exclusivo do superadmin e contém apenas casos corrigidos, autorizados e elegíveis.

## Adicionar uma permissão

1. Defina a regra no backend, junto da rota ou dependência compartilhada.
2. Faça a consulta partir do usuário atual e do relacionamento no banco.
3. Retorne `404` quando revelar a existência do recurso seria um vazamento; use `403` para papel/plano insuficiente.
4. Adicione casos positivo, negativo, acesso cruzado (IDOR) e papel revogado aos testes.
5. Só então adapte a visibilidade do frontend e atualize esta matriz.

Ocultar um botão não é controle de acesso.
