#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/capstone-teaching-assistant-rz2-be"
FRONTEND_DIR="$ROOT_DIR/capstone-teaching-assistant-rz2-app"
COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"

APP_URL="http://localhost:3000"
API_URL="http://localhost:8000"
OLLAMA_URL="http://localhost:11434"
STARTUP_TIMEOUT_SECONDS=120

BACKEND_PID=""
FRONTEND_PID=""
OLLAMA_PID=""
OLLAMA_LOG=""
STARTED_DOCKER_SERVICES=()
CLEANUP_COMPLETE=false

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

warn() {
  printf '\nWarning: %s\n' "$1" >&2
}

die() {
  printf '\nError: %s\n' "$1" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  local installation_url="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    die "Required command '$command_name' was not found. Install it from $installation_url"
  fi
}

stop_process() {
  local process_id="$1"
  local process_name="$2"
  if [[ -n "$process_id" ]] && kill -0 "$process_id" >/dev/null 2>&1; then
    log "Stopping $process_name"
    kill "$process_id" >/dev/null 2>&1 || true
    wait "$process_id" >/dev/null 2>&1 || true
  fi
}

cleanup() {
  local exit_code=$?
  if [[ "$CLEANUP_COMPLETE" == true ]]; then
    return
  fi
  CLEANUP_COMPLETE=true
  trap - EXIT INT TERM
  set +e

  stop_process "$FRONTEND_PID" "frontend"
  stop_process "$BACKEND_PID" "backend"
  stop_process "$OLLAMA_PID" "Ollama"

  if (( ${#STARTED_DOCKER_SERVICES[@]} > 0 )); then
    log "Stopping Docker services started by this run: ${STARTED_DOCKER_SERVICES[*]}"
    docker compose -f "$COMPOSE_FILE" stop "${STARTED_DOCKER_SERVICES[@]}"
  fi

  if [[ -n "$OLLAMA_LOG" && -f "$OLLAMA_LOG" ]]; then
    rm -f "$OLLAMA_LOG"
  fi
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

url_is_ready() {
  curl --fail --silent --show-error --max-time 2 "$1" >/dev/null 2>&1
}

wait_for_url() {
  local service_name="$1"
  local url="$2"
  local process_id="${3:-}"
  local waited=0

  while (( waited < STARTUP_TIMEOUT_SECONDS )); do
    if url_is_ready "$url"; then
      log "$service_name is ready"
      return
    fi
    if [[ -n "$process_id" ]] && ! kill -0 "$process_id" >/dev/null 2>&1; then
      die "$service_name exited before becoming ready."
    fi
    sleep 1
    waited=$((waited + 1))
  done
  die "$service_name did not become ready within ${STARTUP_TIMEOUT_SECONDS} seconds."
}

service_was_running() {
  local service_name="$1"
  printf '%s\n' "$RUNNING_DOCKER_SERVICES" | grep -Fxq "$service_name"
}

log "Checking prerequisites"
require_command docker "https://docs.docker.com/get-docker/"
require_command uv "https://docs.astral.sh/uv/getting-started/installation/"
require_command node "https://nodejs.org/"
require_command npm "https://nodejs.org/"
require_command ollama "https://ollama.com/download"
require_command curl "https://curl.se/download.html"

docker compose version >/dev/null 2>&1 || die "Docker Compose is not available."
docker info >/dev/null 2>&1 || die "Docker is installed but its daemon is not running."

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  log "Creating backend .env from .env.example"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi
if [[ ! -f "$FRONTEND_DIR/.env.local" ]]; then
  log "Creating frontend .env.local from .env.example"
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
fi

log "Synchronizing backend dependencies"
(cd "$BACKEND_DIR" && uv sync)

log "Synchronizing frontend dependencies"
(cd "$FRONTEND_DIR" && npm install)

RUNNING_DOCKER_SERVICES="$(docker compose -f "$COMPOSE_FILE" ps --services --status running)"
for service_name in postgres rustfs; do
  if ! service_was_running "$service_name"; then
    STARTED_DOCKER_SERVICES+=("$service_name")
  fi
done

log "Starting PostgreSQL and RustFS"
docker compose -f "$COMPOSE_FILE" up -d --wait --wait-timeout "$STARTUP_TIMEOUT_SECONDS" postgres rustfs

log "Initializing the RustFS bucket"
docker compose -f "$COMPOSE_FILE" run --rm --no-deps rustfs-init

log "Applying database migrations"
(cd "$BACKEND_DIR" && uv run alembic upgrade head)

log "Seeding the local administrator"
(cd "$BACKEND_DIR" && uv run python tools/seed_local_admin.py)

if ! url_is_ready "$OLLAMA_URL/api/tags"; then
  log "Starting Ollama"
  OLLAMA_LOG="$(mktemp "${TMPDIR:-/tmp}/capstone-ollama.XXXXXX.log")"
  ollama serve >"$OLLAMA_LOG" 2>&1 &
  OLLAMA_PID=$!
  wait_for_url "Ollama" "$OLLAMA_URL/api/tags" "$OLLAMA_PID"
else
  log "Using the existing Ollama server"
fi

for model_name in qwen3.5:4b qwen3-vl:2b qwen3-embedding:0.6b; do
  if ollama show "$model_name" >/dev/null 2>&1; then
    log "Ollama model is already available: $model_name"
  else
    log "Downloading Ollama model: $model_name"
    ollama pull "$model_name"
  fi
done

log "Starting FastAPI on $API_URL"
(cd "$BACKEND_DIR" && exec uv run fastapi dev app/main.py) &
BACKEND_PID=$!

log "Starting Vite on $APP_URL"
(cd "$FRONTEND_DIR" && exec npm run dev) &
FRONTEND_PID=$!

wait_for_url "FastAPI" "$API_URL/openapi.json" "$BACKEND_PID"
wait_for_url "Vite" "$APP_URL" "$FRONTEND_PID"

printf '\nCapstone Teaching Assistant is ready.\n'
printf '  Web app:       %s\n' "$APP_URL"
printf '  API:           %s\n' "$API_URL"
printf '  Swagger:       %s/docs\n' "$API_URL"
printf '  RustFS:        http://localhost:9000\n'
printf '  Default admin: admin / AdminPassword123! (when using the example environment)\n'
printf '  Stop:          Ctrl+C\n\n'

if [[ "${OSTYPE:-}" == darwin* ]] && command -v open >/dev/null 2>&1; then
  open "$APP_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_URL" >/dev/null 2>&1 || warn "Could not open the browser automatically."
else
  warn "No supported browser opener was found. Open $APP_URL manually."
fi

while true; do
  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    wait "$BACKEND_PID" || true
    die "FastAPI exited unexpectedly."
  fi
  if ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    wait "$FRONTEND_PID" || true
    die "Vite exited unexpectedly."
  fi
  sleep 1
done
