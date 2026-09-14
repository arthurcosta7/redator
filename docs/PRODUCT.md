# Produto e regras de negócio

O Redator é uma plataforma de correção e inteligência pedagógica que conecta alunos e professores e transforma cada redação em um plano de evolução. A IA organiza a correção; o professor transforma o diagnóstico em evolução. A nota é uma estimativa pedagógica, nunca uma nota oficial.

## Jornada do aluno

1. Envia texto ou foto em uma correção pessoal, ou entrega uma tarefa.
2. A API valida o conteúdo e reserva um crédito mensal somente para correções pessoais.
3. O worker produz nota, análise por competência, grifes e próximos passos.
4. A primeira correção Free demonstra a resposta completa; as seguintes exibem feedback essencial e as principais grifes.
5. A partir da segunda correção, o dashboard compara o resultado recente e destaca a competência prioritária.
6. Ao acabar o saldo, a oferta usa esse diagnóstico em vez de uma mensagem genérica.

O histórico Free é limitado às cinco redações mais recentes. Entregas de tarefa não consomem créditos pessoais do aluno.

## Créditos mensais de aluno

O período é o mês-calendário UTC. Na primeira operação de um novo mês, o Redis renova a carteira atomicamente. Somente o saldo do mês imediatamente anterior pode acumular.

| Plano | Preço | Correções/mês | Acúmulo | Simulados/mês |
|---|---:|---:|---:|---:|
| Free | R$ 0 | 4 | não acumula | 1 |
| Standard | R$ 18,99 | 12 | até 4 | 3 |
| Pro | R$ 29,99 | 30 | até 10 | 8 |

O número de simulados Pro é configurável por `PLAN_PRO_MONTHLY_SIMULATIONS`; o padrão inicial é 8. Os limites são aplicados no servidor e falham fechados quando o Redis está indisponível, evitando consumo externo sem controle.

## Jornada e capacidade do professor

O professor cria turmas ilimitadas, convida alunos, publica tarefas com prazo, centraliza entregas e consulta análises individuais, por turma e por competência. A geração de tarefa com IA e os relatórios completos começam no Professor 30.

| Plano | Preço | Alunos ativos na conta |
|---|---:|---:|
| Professor Free | R$ 0 | 3 |
| Professor 30 | R$ 49,90/mês | 30 |
| Professor 60 | R$ 89,90/mês | 60 |
| Professor 100 | R$ 149,90/mês | 100 |
| Escola | sob consulta | acima de 100 |

Regras de vaga:

- o limite soma todas as turmas da conta;
- o mesmo usuário ativo em várias turmas conta uma vez;
- cada cadastro offline ativo conta uma vaga;
- convites pendentes não ocupam vaga; a capacidade é revalidada com bloqueio transacional no aceite;
- somente vínculos `active` ocupam vaga; remover (`removed`) libera imediatamente;
- tarefas pertencem à operação docente e não debitam créditos pessoais do aluno.

Capacidades legadas são elevadas, sem redução, ao próximo nível comercial: até
30 vira Professor 30, até 60 vira Professor 60 e até 100 vira Professor 100.
Valores acima de 100 são tratados como contrato Escola. A cobrança antiga deve
ser migrada no Stripe; o pacote legado não aparece em novos checkouts.

## Confiança e contestação

- ENEM usa as competências da rubrica; vestibular considera proposta, gênero, desenvolvimento, coesão e linguagem.
- A escala de vestibular 0–100 é normalização pedagógica do Redator, não nota oficial de FUVEST, Unicamp ou Unesp.
- Feedback deve citar evidências observáveis no texto.
- OCR depende de nitidez e legibilidade; textos incompletos reduzem a confiabilidade.
- Contestação humana só deve ser anunciada como disponível quando houver capacidade real de atendimento.
- Dados autorizados para melhoria são desidentificados; não existe treinamento automático em produção.

## Invariantes de segurança

- Uma redação possui no máximo uma correção e uma contestação.
- Um aluno entrega cada tarefa no máximo uma vez.
- Apenas o dono ou um papel explicitamente autorizado acessa redação e correção.
- A nota só muda por decisão humana fundamentada.
- Texto de redação, nome, email e tema não entram em analytics ou logs operacionais.
