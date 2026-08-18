# Segurança

Segurança é requisito central do Redator por envolver dados pessoais, textos autorais, pagamentos e decisões educacionais. Este documento descreve controles existentes e o processo mínimo de verificação; não representa certificação independente.

## Controles implementados

- Senhas com bcrypt e política de 8–72 bytes, maiúscula, minúscula e dígito.
- JWT de acesso curto e refresh token revogável; cookies HttpOnly, `SameSite=Strict` e `Secure` em produção.
- Tokens de verificação/recuperação armazenados em hash e respostas anti-enumeração.
- Validação Pydantic, sanitização de campos e queries parametrizadas pelo ORM.
- Autorização por proprietário/relacionamento e papéis administrativos consultados no banco.
- Rate limit e cotas atômicas no Redis; ações caras falham fechadas quando o controle está indisponível.
- CORS explícito, headers defensivos, HTTPS obrigatório em produção e mensagens 500 sem detalhes.
- Upload por tamanho, tipo declarado, magic bytes e limite de 40 milhões de pixels.
- Assinatura de webhook Stripe verificada.
- Logs estruturados com redação de campos sensíveis e `request_id`.
- Dataset de melhoria com opt-in, elegibilidade e desidentificação.

## Checklist OWASP orientado ao projeto

| Risco | Verificação esperada |
|---|---|
| Controle de acesso/IDOR | Trocar IDs entre dois usuários deve resultar em 404/403 |
| Injeção | Payloads SQL/HTML/prompt não alteram query, UI ou regras da IA |
| Autenticação | Expiração, revogação, cookies, brute force e recuperação genérica |
| Criptografia | TLS externo, segredos fora do Git, senhas/tokens em hash |
| Configuração | Swagger desativado, CORS restrito e debug falso em produção |
| Dependências | Auditoria periódica de Python, npm e imagens Docker |
| Integridade | Webhook assinado, lockfile e imagens com versões controladas |
| Logging | Eventos úteis sem tokens, cookies, senha ou conteúdo integral |
| SSRF | URLs fornecidas pelo usuário não são buscadas pelo servidor |
| Upload | MIME forjado, arquivo truncado, polyglot e decompression bomb rejeitados |

## Rotina de teste

```bash
cd backend
pytest tests/unit/test_security.py tests/unit/test_security_regressions.py tests/unit/test_correction_appeals.py
ruff check app tests

cd ../frontend
npm audit --omit=dev
npm run type-check
npm run build
```

Também execute scanner de dependências/imagens no CI, teste DAST apenas contra staging autorizado e faça revisão manual antes de releases com autenticação, pagamento ou permissão.

## Resposta a incidente

1. Preserve evidências e registre horário/escopo.
2. Contenha: revogue credenciais, bloqueie vetor e limite acesso.
3. Avalie dados afetados e obrigações legais/LGPD com responsável qualificado.
4. Corrija, teste em staging e publique com plano de rollback.
5. Monitore recorrência e documente causa raiz e ações preventivas.

Não realize testes destrutivos, exfiltração ou carga agressiva em produção.
