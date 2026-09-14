# Documentação do Redator

Este diretório é a fonte de verdade técnica e operacional do projeto. O contrato exato dos corpos e respostas da API também pode ser consultado no Swagger em `http://localhost:8000/docs` durante o desenvolvimento; essa interface é desativada em produção.

## Comece por aqui

| Objetivo | Documento |
|---|---|
| Entender produto, perfis e planos | [Produto e regras de negócio](PRODUCT.md) |
| Entender os componentes e fluxos | [Arquitetura](ARCHITECTURE.md) |
| Executar o projeto localmente | [Desenvolvimento local](DEVELOPMENT.md) |
| Configurar ambientes e segredos | [Configuração](CONFIGURATION.md) |
| Integrar ou alterar endpoints | [API](API.md) |
| Alterar tabelas e migrações | [Banco de dados](DATABASE.md) |
| Entender papéis e autorização | [Papéis e permissões](ROLES_AND_PERMISSIONS.md) |
| Entender correção, OCR e contestação | [IA e correções](AI_CORRECTIONS.md) |
| Medir produto sem expor redações | [Métricas de produto](PRODUCT_ANALYTICS.md) |
| Revisar controles e ameaças | [Segurança](SECURITY.md) |
| Entender a estratégia e os critérios de qualidade | [Estratégia de testes](TESTING.md) |
| Consultar o que cada suíte cobre | [Catálogo de testes](TEST_CATALOG.md) |
| Preparar, executar e diagnosticar testes | [Operação dos testes](TEST_OPERATIONS.md) |
| Publicar Vercel + VPS | [Deploy](DEPLOYMENT.md) |
| Monitorar, recuperar ou investigar incidentes | [Operações](OPERATIONS.md) |
| Diagnosticar erros comuns | [Troubleshooting](TROUBLESHOOTING.md) |
| Entender capacidade e dimensionamento | [Escalabilidade](SCALABILITY.md) |

## Princípios da documentação

- O código e as migrações prevalecem em caso de divergência.
- Novas rotas, variáveis, tabelas, papéis ou serviços devem atualizar a página correspondente no mesmo pull request.
- Nunca copie valores reais de `.env`, tokens, redações ou dados pessoais para exemplos, issues ou logs.
- Valores comerciais exibidos no frontend devem ser conferidos no Stripe antes de uma publicação.

Última revisão estrutural: 18 de agosto de 2026.
