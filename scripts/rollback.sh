#!/usr/bin/env bash
# Retorna API e worker as imagens registradas antes do ultimo deploy.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
STATE_FILE="${STATE_FILE:-$ROOT_DIR/.deploy/last-release.env}"

[[ "${ROLLBACK_CONFIRM:-}" == "redator" ]] || {
  printf 'ERRO: defina ROLLBACK_CONFIRM=redator para autorizar o rollback.\n' >&2
  exit 1
}
[[ -f "$STATE_FILE" ]] || { printf 'ERRO: estado de release ausente: %s\n' "$STATE_FILE" >&2; exit 1; }

# O arquivo e gerado exclusivamente por deploy.sh e contem apenas valores Docker
# e caminhos escapados pelo proprio script.
# shellcheck disable=SC1090
source "$STATE_FILE"
[[ -n "${PREVIOUS_BACKEND_IMAGE:-}" && -n "${BACKEND_TARGET_TAG:-}" ]] \
  || { printf 'ERRO: nao ha imagem anterior de backend registrada.\n' >&2; exit 1; }
[[ -n "${PREVIOUS_WORKER_IMAGE:-}" && -n "${WORKER_TARGET_TAG:-}" ]] \
  || { printf 'ERRO: nao ha imagem anterior de worker registrada.\n' >&2; exit 1; }

docker image inspect "$PREVIOUS_BACKEND_IMAGE" >/dev/null
docker image inspect "$PREVIOUS_WORKER_IMAGE" >/dev/null
docker image tag "$PREVIOUS_BACKEND_IMAGE" "$BACKEND_TARGET_TAG"
docker image tag "$PREVIOUS_WORKER_IMAGE" "$WORKER_TARGET_TAG"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build --force-recreate --wait backend correction_worker
curl --fail --silent --show-error http://127.0.0.1:8000/ready >/dev/null

printf 'Rollback de aplicacao concluido. Commit anterior: %s\n' "${PREVIOUS_COMMIT:-desconhecido}"
printf 'Se o schema for incompativel, restaure explicitamente: RESTORE_CONFIRM=redator ./scripts/restore-postgres.sh %q\n' "${BACKUP_PATH:-}"
