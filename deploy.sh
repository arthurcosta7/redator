#!/usr/bin/env bash
# Deploy da API/worker com preflight, backup e ponto de rollback.

set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
STATE_DIR="$ROOT_DIR/.deploy"
STATE_FILE="$STATE_DIR/last-release.env"
release_id="$(date -u +'%Y%m%dT%H%M%SZ')"

cd "$ROOT_DIR"
bash "$ROOT_DIR/scripts/preflight.sh"
previous_commit="$(git rev-parse HEAD)"

if [[ "${SKIP_PULL:-0}" != "1" ]]; then
  [[ -z "$(git status --porcelain)" ]] || {
    printf 'ERRO: checkout possui alteracoes locais; deploy interrompido.\n' >&2
    exit 1
  }
  git pull --ff-only origin producao
  bash "$ROOT_DIR/scripts/preflight.sh"
fi

backend_container="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q backend 2>/dev/null || true)"
worker_container="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q correction_worker 2>/dev/null || true)"
previous_backend_image=""
previous_worker_image=""
backend_target_tag=""
worker_target_tag=""

if [[ -n "$backend_container" ]]; then
  previous_backend_image="redator-backend:rollback-$release_id"
  docker image tag "$(docker inspect --format '{{.Image}}' "$backend_container")" "$previous_backend_image"
  backend_target_tag="$(docker inspect --format '{{.Config.Image}}' "$backend_container")"
fi
if [[ -n "$worker_container" ]]; then
  previous_worker_image="redator-worker:rollback-$release_id"
  docker image tag "$(docker inspect --format '{{.Image}}' "$worker_container")" "$previous_worker_image"
  worker_target_tag="$(docker inspect --format '{{.Config.Image}}' "$worker_container")"
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --wait postgres redis
backup_path="$(bash "$ROOT_DIR/scripts/backup-postgres.sh")"

mkdir -p "$STATE_DIR"
{
  printf 'PREVIOUS_COMMIT=%q\n' "$previous_commit"
  printf 'PREVIOUS_BACKEND_IMAGE=%q\n' "$previous_backend_image"
  printf 'PREVIOUS_WORKER_IMAGE=%q\n' "$previous_worker_image"
  printf 'BACKEND_TARGET_TAG=%q\n' "$backend_target_tag"
  printf 'WORKER_TARGET_TAG=%q\n' "$worker_target_tag"
  printf 'BACKUP_PATH=%q\n' "$backup_path"
} > "$STATE_FILE"

on_error() {
  printf '\nDeploy falhou. Banco preservado em: %s\n' "$backup_path" >&2
  if [[ -n "$previous_backend_image" && -n "$previous_worker_image" ]]; then
    printf 'Rollback disponivel: ROLLBACK_CONFIRM=redator ./scripts/rollback.sh\n' >&2
  fi
}
trap on_error ERR

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build backend correction_worker
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend alembic upgrade head
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --wait backend correction_worker
curl --fail --silent --show-error http://127.0.0.1:8000/health >/dev/null
curl --fail --silent --show-error http://127.0.0.1:8000/ready >/dev/null
trap - ERR

printf 'Deploy concluido. Release: %s | backup: %s\n' "$release_id" "$backup_path"
