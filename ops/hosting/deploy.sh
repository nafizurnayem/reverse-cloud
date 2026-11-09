#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly HOSTING_ROOT="${REVERSE_CLOUD_HOSTING_ROOT:-/home/nafz/reverse-cloud-hosting}"
readonly REPOSITORY_DIR="${HOSTING_ROOT}/repository"
readonly SECRETS_DIR="${HOSTING_ROOT}/secrets"
readonly STATE_DIR="${HOSTING_ROOT}/state"
readonly COMPOSE_FILE="${HOSTING_ROOT}/docker-compose.yml"
readonly DEPLOY_ENV="${HOSTING_ROOT}/.deploy.env"
readonly WEB_ENV="${SECRETS_DIR}/web.env"
readonly TUNNEL_TOKEN="${SECRETS_DIR}/cloudflare-tunnel-token"
readonly STATE_FILE="${STATE_DIR}/deployed-dev-sha"
readonly LOCK_FILE="${STATE_DIR}/deploy.lock"
readonly DEPLOY_KEY="/home/nafz/.ssh/reverse_cloud_deploy"
readonly REPOSITORY_URL="git@github.com:nafizurnayem/reverse-cloud.git"
readonly DEPLOY_BRANCH="Dev"
readonly WEB_CONTAINER="reverse-cloud-web"
readonly CANDIDATE_CONTAINER="reverse-cloud-web-candidate"
readonly AI_CONTAINER="reverse-cloud-ai"
readonly AI_CANDIDATE_CONTAINER="reverse-cloud-ai-candidate"
readonly WEB_IMAGE_REPOSITORY="reverse-cloud-preview"
readonly AI_IMAGE_REPOSITORY="reverse-cloud-ai"

mode="${1:-deploy}"
if [[ "$mode" != "deploy" && "$mode" != "--force" ]]; then
  printf 'Usage: %s [--force]\n' "$0" >&2
  exit 2
fi

log() {
  printf '%s %s\n' "$(date --iso-8601=seconds)" "$*"
}

require_env_value() {
  local key="$1"
  local file="$2"
  if ! awk -v key="$key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
    }
    END { exit length(value) > 0 ? 0 : 1 }
  ' "$file"; then
    log "ERROR: ${key} must have a non-empty value in ${file}"
    exit 1
  fi
}

compose() {
  docker compose \
    --project-directory "$HOSTING_ROOT" \
    --env-file "$DEPLOY_ENV" \
    --file "$COMPOSE_FILE" \
    "$@"
}

wait_for_health() {
  local port="$1"
  local attempt
  for attempt in $(seq 1 60); do
    if curl --fail --silent --show-error --max-time 5 \
      "http://127.0.0.1:${port}/api/health" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

wait_for_ai_health() {
  local port="$1"
  local attempt
  for attempt in $(seq 1 90); do
    if curl --fail --silent --show-error --max-time 5 \
      "http://127.0.0.1:${port}/ready" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

cleanup_candidate() {
  if docker container inspect "$CANDIDATE_CONTAINER" >/dev/null 2>&1; then
    docker rm --force "$CANDIDATE_CONTAINER" >/dev/null 2>&1 || true
  fi
  if docker container inspect "$AI_CANDIDATE_CONTAINER" >/dev/null 2>&1; then
    docker rm --force "$AI_CANDIDATE_CONTAINER" >/dev/null 2>&1 || true
  fi
}

write_deploy_env() {
  local web_image="$1"
  local ai_image="$2"
  local public_origin="$3"
  local temporary="${DEPLOY_ENV}.tmp"
  printf 'WEB_IMAGE=%s\nAI_IMAGE=%s\nPUBLIC_ORIGIN=%s\n' \
    "$web_image" "$ai_image" "$public_origin" > "$temporary"
  mv "$temporary" "$DEPLOY_ENV"
}

mkdir -p "$STATE_DIR"
exec 9>"$LOCK_FILE"
if ! flock --nonblock 9; then
  exit 0
fi

for required_file in "$COMPOSE_FILE" "$WEB_ENV" "$TUNNEL_TOKEN" "$DEPLOY_KEY"; do
  if [[ ! -r "$required_file" ]]; then
    log "ERROR: required file is missing or unreadable: ${required_file}"
    exit 1
  fi
done

public_origin="$(sed -n 's/^NEXT_PUBLIC_SITE_URL=//p' "$WEB_ENV" | tail -n 1 | tr -d '\r')"
if [[ ! "$public_origin" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
  log "ERROR: NEXT_PUBLIC_SITE_URL must be an exact HTTPS origin"
  exit 1
fi
require_env_value "DATABASE_URL_AI" "$WEB_ENV"
require_env_value "AI_HMAC_SECRET_CURRENT" "$WEB_ENV"

if [[ ! -r "$DEPLOY_ENV" ]]; then
  write_deploy_env \
    "${WEB_IMAGE_REPOSITORY}:unconfigured" \
    "${AI_IMAGE_REPOSITORY}:unconfigured" \
    "$public_origin"
fi

# Use GitHub's standard SSH endpoint. This server can reach github.com:22,
# while ssh.github.com:443 is blocked by the local network and stalls updates.
export GIT_SSH_COMMAND="ssh -i ${DEPLOY_KEY} -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes"

if [[ ! -d "${REPOSITORY_DIR}/.git" ]]; then
  log "Cloning ${DEPLOY_BRANCH} from GitHub"
  git clone --single-branch --branch "$DEPLOY_BRANCH" "$REPOSITORY_URL" "$REPOSITORY_DIR"
else
  git -C "$REPOSITORY_DIR" fetch --prune origin \
    "refs/heads/${DEPLOY_BRANCH}:refs/remotes/origin/${DEPLOY_BRANCH}"
fi

target_sha="$(git -C "$REPOSITORY_DIR" rev-parse "refs/remotes/origin/${DEPLOY_BRANCH}")"
if [[ ! "$target_sha" =~ ^[0-9a-f]{40}$ ]]; then
  log "ERROR: GitHub returned an invalid ${DEPLOY_BRANCH} commit"
  exit 1
fi

web_image="${WEB_IMAGE_REPOSITORY}:${target_sha}"
ai_image="${AI_IMAGE_REPOSITORY}:${target_sha}"
deployed_sha=""
if [[ -r "$STATE_FILE" ]]; then
  deployed_sha="$(tr -d '[:space:]' < "$STATE_FILE")"
fi
live_web_image="$(docker inspect --format='{{.Config.Image}}' "$WEB_CONTAINER" 2>/dev/null || true)"
live_ai_image="$(docker inspect --format='{{.Config.Image}}' "$AI_CONTAINER" 2>/dev/null || true)"

if [[ "$mode" != "--force" && "$target_sha" == "$deployed_sha" \
  && "$live_web_image" == "$web_image" && "$live_ai_image" == "$ai_image" ]] \
  && wait_for_health 3000 && wait_for_ai_health 8000; then
  exit 0
fi

log "Preparing ${DEPLOY_BRANCH} commit ${target_sha}"
git -C "$REPOSITORY_DIR" checkout --force --detach "$target_sha"

# Keep the host-level deployment definitions in sync with the checked-out
# branch. This is required because Compose and the cron entry run outside the
# repository, while new services may be introduced inside the repository.
install -m 0644 "${REPOSITORY_DIR}/ops/hosting/docker-compose.yml" "$COMPOSE_FILE"
install -m 0755 "${REPOSITORY_DIR}/ops/hosting/deploy.sh" "${HOSTING_ROOT}/deploy.sh"

web_build_options=(
  --secret "id=web_env,src=${WEB_ENV}"
  --file "${REPOSITORY_DIR}/Dockerfile.preview"
  --tag "$web_image"
)
ai_build_options=(
  --file "${REPOSITORY_DIR}/Dockerfile.ai"
  --tag "$ai_image"
)
if [[ "$mode" == "--force" ]]; then
  web_build_options+=(--no-cache)
  ai_build_options+=(--no-cache)
fi

log "Building ${web_image}"
DOCKER_BUILDKIT=1 docker build "${web_build_options[@]}" "$REPOSITORY_DIR"
log "Building ${ai_image}"
DOCKER_BUILDKIT=1 docker build "${ai_build_options[@]}" "$REPOSITORY_DIR"

compose up --detach ollama
docker exec reverse-cloud-ollama ollama pull llama3.2:3b
docker exec reverse-cloud-ollama ollama pull qwen3-embedding:0.6b

cleanup_candidate
trap cleanup_candidate EXIT
log "Running AI candidate health check on port 8001"
docker run --detach \
  --name "$AI_CANDIDATE_CONTAINER" \
  --restart no \
  --network host \
  --mount "type=bind,src=${WEB_ENV},dst=/app/services/ai/.env.local,readonly" \
  --env OLLAMA_URL=http://127.0.0.1:11434 \
  --env OLLAMA_MODEL=llama3.2:3b \
  --env OLLAMA_EMBEDDING_MODEL=qwen3-embedding:0.6b \
  "$ai_image" \
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --proxy-headers >/dev/null

if ! wait_for_ai_health 8001; then
  docker logs --tail 100 "$AI_CANDIDATE_CONTAINER" || true
  log "ERROR: AI candidate health check failed; live site was not changed"
  exit 1
fi

log "Synchronizing public website knowledge"
docker exec "$AI_CANDIDATE_CONTAINER" python -m scripts.sync_content_knowledge
docker exec "$AI_CANDIDATE_CONTAINER" python -m scripts.reindex_knowledge --missing-only

log "Running live AI regression smoke test"
if ! docker exec "$AI_CANDIDATE_CONTAINER" \
  python -m evals.run_evals --base-url http://127.0.0.1:8001 --smoke; then
  docker logs --tail 100 "$AI_CANDIDATE_CONTAINER" || true
  log "ERROR: live AI regression test failed; live site was not changed"
  exit 1
fi

log "Running candidate health check on port 3001"
docker run --detach \
  --name "$CANDIDATE_CONTAINER" \
  --restart no \
  --network host \
  --mount "type=bind,src=${WEB_ENV},dst=/app/apps/web/.env.local,readonly" \
  --env LOCAL_OLLAMA_PREVIEW=false \
  --env AI_SERVICE_URL=http://127.0.0.1:8001 \
  --env "TRUSTED_PUBLIC_ORIGINS=${public_origin}" \
  "$web_image" \
  pnpm --filter @reverse-cloud/web exec next start -H localhost -p 3001 >/dev/null

if ! wait_for_health 3001; then
  docker logs --tail 100 "$CANDIDATE_CONTAINER" || true
  log "ERROR: candidate health check failed; live site was not changed"
  exit 1
fi
cleanup_candidate

previous_env="${STATE_DIR}/deploy.env.rollback"
if [[ -r "$DEPLOY_ENV" ]]; then
  cp "$DEPLOY_ENV" "$previous_env"
else
  rm -f "$previous_env"
fi

write_deploy_env "$web_image" "$ai_image" "$public_origin"
log "Starting AI service for ${target_sha} on port 8000"
if ! compose up --detach --no-deps --force-recreate ai || ! wait_for_ai_health 8000; then
  docker logs --tail 100 "$AI_CONTAINER" || true
  if [[ -r "$previous_env" ]]; then
    cp "$previous_env" "$DEPLOY_ENV"
    compose up --detach --no-deps --force-recreate ai || true
  fi
  log "ERROR: live AI health check failed; previous Compose configuration restored"
  exit 1
fi

if ! compose up --detach --no-deps --force-recreate knowledge-sync ai-monitor; then
  if [[ -r "$previous_env" ]]; then
    cp "$previous_env" "$DEPLOY_ENV"
    compose up --detach --no-deps --force-recreate ai knowledge-sync ai-monitor || true
  fi
  log "ERROR: AI worker startup failed; previous Compose configuration restored"
  exit 1
fi

log "Starting web service for ${target_sha} on port 3000"
if ! compose up --detach --no-deps --force-recreate web || ! wait_for_health 3000; then
  docker logs --tail 100 "$WEB_CONTAINER" || true
  if [[ -r "$previous_env" ]]; then
    cp "$previous_env" "$DEPLOY_ENV"
    compose up --detach --no-deps --force-recreate ai || true
    compose up --detach --no-deps --force-recreate knowledge-sync || true
    compose up --detach --no-deps --force-recreate ai-monitor || true
    compose up --detach --no-deps --force-recreate web || true
    wait_for_health 3000 || log "ERROR: rollback image did not become healthy"
  fi
  log "ERROR: live health check failed; previous Compose configuration restored"
  exit 1
fi

state_tmp="${STATE_FILE}.tmp"
printf '%s\n' "$target_sha" > "$state_tmp"
mv "$state_tmp" "$STATE_FILE"
rm -f "$previous_env"
log "Deployment succeeded for ${target_sha}"
