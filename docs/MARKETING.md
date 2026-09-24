# Marketing e vendas — operação interna

## Acesso

A rota `/marketing` é interna. O superadmin concede `sales` (vendedor) ou `marketing_manager` (gestor) em **Equipe**, a um usuário já cadastrado. O vendedor deve entrar novamente após a concessão para iniciar uma sessão comercial. A API verifica o papel no banco a cada chamada.

| Papel | Links e métricas | Leads | Revisão de suspeitas |
|---|---|---|---|
| `sales` | Próprios | Próprios | Não |
| `marketing_manager` | Equipe e filtro por vendedor | Equipe e filtro | Não |
| `admin` / `superadmin` | Todos | Todos | Sim |

Sessões de vendedor/gestor expiram após 30 minutos sem chamadas à API de marketing. A sessão é vinculada ao refresh token e ao Redis; apenas renovar o access token não reinicia o prazo. Uma sessão expirada exige novo login. Admins mantêm a política de sessão administrativa já existente.

## O que as métricas significam

- **Clique:** visita à rota de indicação com registro bem-sucedido. Não é visitante único; visitas repetidas e bots dentro do limite podem contar. O limite é 100 por hora, por link e origem pseudonimizada. Cliques anteriores à implantação não serão reconstruídos.
- **Cadastro atribuído:** conta criada com o código de indicação. Pode estar em revisão ou rejeitada.
- **Pagante válido:** primeira assinatura com pagamento confirmado e atribuição com status `valid`. Renovações não contam novamente.
- **Primeiras cobranças:** soma bruta em BRL dos valores conhecidos da primeira cobrança dos pagantes válidos. Não representa receita líquida, comissão, receita recorrente nem LTV. Dados antigos podem mostrar R$ 0 porque o valor não era persistido antes desta migração.
- **Série diária:** últimos 30 dias em UTC. Os totais do topo são históricos; o gráfico mostra apenas esta janela.
- **Leads convertidos:** etapa manual do CRM, separada de assinatura paga; não deve ser confundida com conversões Stripe.

## CRM e privacidade

Leads são registros internos criados manualmente. Não há importação automática das contas de alunos nem exposição de e-mail/telefone dos usuários indicados. Antes de adicionar um lead, o funcionário confirma ter autorização para registrar e contatar a pessoa; a data é salva. Nome, e-mail, telefone e observações usam a criptografia de campo já existente (`DATA_ENCRYPTION_KEY`) em produção. O conteúdo dos leads não entra nos logs; acessos e mudanças registram IDs do operador e escopo. Valide a base legal, a política de retenção e o texto de consentimento com orientação jurídica antes de operar o CRM em produção.

Os modelos de acompanhamento são apenas texto copiável. Não há envio automatizado por WhatsApp, SMS ou e-mail para leads. Pedidos para parar de receber mensagens devem ser respeitados pela equipe.

## Configuração e deploy

1. Aplique `alembic upgrade head` no backend antes de ativar a versão nova. A migração adiciona os dois papéis ao enum PostgreSQL, os cliques, a primeira cobrança e a tabela de leads. O downgrade preserva os valores de enum PostgreSQL, por limitação do banco.
2. Gere uma chave aleatória com pelo menos 32 caracteres para `REFERRAL_CLICK_SECRET`. Coloque o **mesmo valor** em `.env` do backend e nas variáveis **server-side** da Vercel; não a exponha ao navegador. Configure também `NEXT_PUBLIC_API_URL` com a origem pública da API. Sem essas variáveis no Next.js, o link ainda redireciona e atribui cadastros, mas não conta cliques.
3. Configure `RESEND_API_KEY` e o remetente existente para o relatório semanal. O serviço `marketing_worker` em `docker-compose.prod.yml` agenda o envio às segundas-feiras às 12:00 UTC. Vendedores recebem somente a própria linha; gestores recebem a equipe. O relatório contém contagens, não dados dos leads. Se o Resend não estiver configurado, o job não envia.
4. Reinicie backend, worker de marketing e frontend depois de aplicar as variáveis e a migração. Nenhum deploy foi executado nesta tarefa.

## Verificações antes de produção

- Dois vendedores: confirme que um não vê nem edita leads, links e métricas do outro.
- Gestor: filtros por vendedor e consolidação. Admin: revisão de suspeitas e link para parceiro.
- Link ativo: clique, cadastro e fatura positiva devem aparecer; fatura duplicada não deve duplicar a conversão. Link pausado não atribui novos cadastros.
- 101 cliques rápidos da mesma origem: o 101º deve receber HTTP 429 na API, sem impedir o redirecionamento público.
- Inatividade acima de 30 minutos: requisição comercial deve exigir login.
- Execute `pytest`, lint, type-check, build e Playwright com viewport desktop e móvel.
