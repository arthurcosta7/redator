# Indicações privadas

## Fluxo

1. Em `/marketing`, `superadmin` ou `admin` pode criar links para usuários ativos sem papel administrativo. Vendedores e gestores de marketing também podem gerar o próprio link pessoal.
2. O link `/r/{code}` salva um cookie próprio de 30 dias e redireciona para a landing page sem exibir programa de indicação.
3. No cadastro, o cliente envia o código e um identificador aleatório local. A API valida o código e atribui a conta **somente na criação inicial**. Reenvio da verificação de e-mail não troca a atribuição.
4. O webhook Stripe registra a primeira conversão após pagamento confirmado (`checkout.session.completed` com `payment_status=paid` ou `invoice.paid` com valor positivo). A operação é idempotente; renovação não aumenta a contagem.
5. A aba `/marketing` mostra cliques, cadastros, conversões pagas válidas e o valor conhecido da primeira cobrança. A revisão de suspeitas continua exclusiva dos admins. Pausar o link impede novas atribuições, sem apagar o histórico.

Não há comissão, crédito, desconto nem pagamento automático. Essas regras exigem decisão comercial e fluxo antifraude próprios antes de implementação.

## Segurança e limites

- Somente `superadmin` e `admin` revisam suspeitas e criam links para usuários comuns. `sales` vê apenas os próprios links; `marketing_manager` vê os da equipe. A API verifica a permissão no banco a cada chamada.
- A rota pública `/r/{code}` envia uma chamada autenticada ao backend para contar o clique. Configure o mesmo `REFERRAL_CLICK_SECRET` (32+ caracteres aleatórios) no servidor Next.js da Vercel e no backend. Nunca use `NEXT_PUBLIC_` para esse segredo. O backend recebe apenas um HMAC temporário da origem, aplica 100 cliques/hora por link/origem e não persiste IP nem user-agent. Se a API de métricas cair, o redirecionamento continua; por isso o total de cliques pode ser menor que o tráfego real.
- O código é aleatório de 192 bits e não concede privilégios. Atribuição é única por usuário.
- O rate limiter existente limita cadastros por IP. Para indicações, Redis guarda por 90 dias somente HMACs de IP e identificador local, separados por dono do link; IP e identificador brutos não entram no banco nem em logs.
- Reuso de rede/dispositivo marca `review`. A conta pode ser criada normalmente, mas a conversão não aparece como válida até aprovação. Isso evita punir alunos da mesma escola ou família.
- Navegadores não oferecem HWID confiável. O identificador local pode ser apagado, e IP pode ser compartilhado/trocado; essas verificações reduzem abuso simples, não garantem unicidade de pessoa. Para remuneração futura, exija também verificação de identidade, análise de meio de pagamento e janela de estorno.
- Em produção, o Compose ativa `TRUST_PROXY_REAL_IP=true` porque a API fica vinculada a `127.0.0.1` no host e o Nginx sobrescreve `X-Real-IP` com `$remote_addr`. Não habilite essa opção se houver acesso direto à API ou outro proxy que não sobrescreva o cabeçalho; nunca confie indiscriminadamente em `X-Forwarded-For`.
- O uso do cookie e dos sinais antifraude é divulgado em `/privacy`, sem promover o programa ao usuário comum. Revise a política com orientação jurídica antes do lançamento.

## Operação

Antes de iniciar backend atualizado, aplique `cd backend && .\.venv\Scripts\python.exe -m alembic upgrade head` no Windows ou o comando de migração equivalente no deploy. Confira eventos `referral_link_created`, `referral_signup_attributed`, `referral_paid_conversion` e `referral_reviewed`; não logue códigos, IPs ou dados de pagamento.

No webhook Stripe, habilite `checkout.session.completed` e `invoice.paid` além dos eventos de assinatura já usados. O segundo cobre pagamentos assíncronos ou eventos recebidos fora de ordem. Faça a migração antes de ativar o backend novo: sem as tabelas a criação de links e o cadastro com indicação falham.
