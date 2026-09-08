#!/usr/bin/env bash
# Gera dump custom do PostgreSQL com permissoes restritas e checksum SHA-256.

set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
backup_path="$BACKUP_DIR/redator-$timestamp-$$.dump"

[[ -f "$ENV_FILE" ]] || { printf 'ERRO: .env ausente.\n' >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --wait postgres >/dev/null
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  sh -c 'pg_dump --format=custom --compress=9 --no-owner --no-privileges --username="$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$backup_path"

[[ -s "$backup_path" ]] || { rm -f -- "$backup_path"; printf 'ERRO: backup vazio.\n' >&2; exit 1; }
(cd "$BACKUP_DIR" && sha256sum "$(basename "$backup_path")" > "$(basename "$backup_path").sha256")
printf 'Backup criado e verificado: %s\n' "$backup_path" >&2
printf '%s\n' "$backup_path"
