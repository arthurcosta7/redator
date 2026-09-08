#!/usr/bin/env bash
# Restaura um dump somente com confirmacao explicita e cria backup de seguranca.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
backup_path="${1:-}"

[[ "${RESTORE_CONFIRM:-}" == "redator" ]] || {
  printf 'ERRO: defina RESTORE_CONFIRM=redator para autorizar a restauracao.\n' >&2
  exit 1
}
[[ -n "$backup_path" && -f "$backup_path" ]] || {
  printf 'Uso: RESTORE_CONFIRM=redator %s caminho/do/backup.dump\n' "$0" >&2
  exit 1
}

if [[ -f "$backup_path.sha256" ]]; then
  (cd "$(dirname "$backup_path")" && sha256sum --check "$(basename "$backup_path").sha256")
else
  printf 'AVISO: checksum lateral ausente; valide a origem do arquivo.\n' >&2
fi

safety_backup="$(bash "$ROOT_DIR/scripts/backup-postgres.sh")"
printf 'Backup anterior a restauracao: %s\n' "$safety_backup" >&2

restart_services() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend correction_worker >/dev/null 2>&1 || true
}
trap restart_services EXIT

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop backend correction_worker
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  sh -c 'pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  < "$backup_path"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --wait backend correction_worker
curl --fail --silent --show-error http://127.0.0.1:8000/ready >/dev/null
trap - EXIT
printf 'Restauracao concluida e servicos saudaveis.\n'
