#!/usr/bin/env bash
# Valida dependencias e configuracao antes de qualquer alteracao no ambiente.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

fail() {
  printf 'ERRO: %s\n' "$*" >&2
  exit 1
}

for command_name in docker git curl; do
  command -v "$command_name" >/dev/null 2>&1 || fail "comando ausente: $command_name"
done

docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 nao esta disponivel"
[[ -f "$ENV_FILE" ]] || fail "arquivo de ambiente ausente: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "arquivo Compose ausente: $COMPOSE_FILE"

required_vars=(
  ENVIRONMENT SECRET_KEY POSTGRES_USER POSTGRES_PASSWORD REDIS_PASSWORD
  FRONTEND_URL ALLOWED_ORIGINS OPENAI_API_KEY OPENAI_CORRECTION_MODEL OPENAI_FREE_MODEL
  OPENAI_PAID_MODEL STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET STRIPE_PRICE_STANDARD_MONTHLY
  STRIPE_PRICE_STANDARD_QUARTERLY STRIPE_PRICE_PRO_MONTHLY
  STRIPE_PRICE_PRO_QUARTERLY STRIPE_PRICE_TEACHER_PACKAGE
  RESEND_API_KEY FROM_EMAIL
)

for variable_name in "${required_vars[@]}"; do
  grep -Eq "^[[:space:]]*${variable_name}=[^[:space:]].*$" "$ENV_FILE" \
    || fail "variavel obrigatoria vazia ou ausente: $variable_name"
done

if grep -Eqi '(<PREENCHER|CHANGE_ME|CHANGEME|example-secret|your[_-].*key)' "$ENV_FILE"; then
  fail "o .env ainda contem um valor de exemplo ou placeholder"
fi

if grep -Eq '^[[:space:]]*ALLOWED_ORIGINS=.*\*' "$ENV_FILE"; then
  fail "ALLOWED_ORIGINS nao pode conter wildcard"
fi

environment_value="$(sed -nE 's/^[[:space:]]*ENVIRONMENT=([^[:space:]#]+).*/\1/p' "$ENV_FILE" | tail -n 1 | tr -d '\r\"')"
[[ "$environment_value" == "production" || "$environment_value" == "staging" ]] \
  || fail "ENVIRONMENT deve ser production ou staging"

if command -v stat >/dev/null 2>&1; then
  env_mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
  if [[ -n "$env_mode" && "${env_mode: -2}" != "00" ]]; then
    fail "$ENV_FILE deve permitir acesso apenas ao proprietario (execute chmod 600)"
  fi
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
printf 'Preflight concluido: configuracao pronta para deploy.\n'
