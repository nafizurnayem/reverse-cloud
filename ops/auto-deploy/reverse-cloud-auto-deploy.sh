#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly REPOSITORY_URL="git@github.com:nafizurnayem/reverse-cloud.git"
readonly DEPLOY_BRANCH="Dev"
readonly DEPLOY_ROOT="/home/nafz/reverse-cloud-auto"
readonly REPOSITORY_DIR="${DEPLOY_ROOT}/repository"
readonly STATE_FILE="${DEPLOY_ROOT}/deployed-dev-sha"
readonly LOCK_FILE="${DEPLOY_ROOT}/deploy.lock"
readonly ENV_FILE="/home/nafz/reverse-cloud-preview/apps/web/.env.local"
readonly DEPLOY_KEY="/home/nafz/.ssh/reverse_cloud_deploy"
readonly WEB_CONTAINER="reverse-cloud-web"
readonly CANDIDATE_CONTAINER="reverse-cloud-web-candidate"
readonly ROLLBACK_CONTAINER="reverse-cloud-web-rollback"
readonly IMAGE_REPOSITORY="reverse-cloud-preview"
readonly OLLAMA_URL="http://127.0.0.1:11434"
readonly OLLAMA_MODEL="llama3.2:1b"

mode="${1:-deploy}"
if [[ "$mode" != "deploy" && "$mode" != "--baseline" ]]; then
  printf 'Usage: %s [--baseline]\n' "$0" >&2
  exit 2
fi

log() {
  printf '%s %s\n' "$(date --iso-8601=seconds)" "$*"
}

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

wait_for_health() {
  local port="$1"
  local attempt
  for attempt in $(seq 1 45); do
    if curl --fail --silent --show-error --max-time 5 \
      "http://127.0.0.1:${port}/api/health" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

run_web_container() {
  local name="$1"
  local image="$2"
  local port="$3"
  local restart_policy="$4"

  docker run --detach \
    --name "$name" \
    --restart "$restart_policy" \
    --network host \
    --mount "type=bind,src=${ENV_FILE},dst=/app/apps/web/.env.local,readonly" \
    --env LOCAL_OLLAMA_PREVIEW=true \
    --env "OLLAMA_URL=${OLLAMA_URL}" \
    --env "OLLAMA_MODEL=${OLLAMA_MODEL}" \
    --env "TRUSTED_PUBLIC_ORIGINS=${PUBLIC_ORIGIN}" \
    "$image" \
    pnpm --filter @reverse-cloud/web exec next start -H 127.0.0.1 -p "$port" >/dev/null
}

cleanup_candidate() {
  if container_exists "$CANDIDATE_CONTAINER"; then
    docker rm --force "$CANDIDATE_CONTAINER" >/dev/null 2>&1 || true
  fi
}

mkdir -p "$DEPLOY_ROOT"
exec 9>"$LOCK_FILE"
if ! flock --nonblock 9; then
  exit 0
fi

if [[ ! -r "$ENV_FILE" ]]; then
  log "ERROR: deployment environment file is missing or unreadable"
  exit 1
fi
if [[ ! -r "$DEPLOY_KEY" ]]; then
  log "ERROR: GitHub deploy key is missing or unreadable"
  exit 1
fi

PUBLIC_ORIGIN="$(sed -n 's/^NEXT_PUBLIC_SITE_URL=//p' "$ENV_FILE" | tail -n 1)"
if [[ ! "$PUBLIC_ORIGIN" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
  log "ERROR: NEXT_PUBLIC_SITE_URL must be an exact HTTPS origin"
  exit 1
fi
export PUBLIC_ORIGIN

export GIT_SSH_COMMAND="ssh -i ${DEPLOY_KEY} -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes"

if [[ ! -d "${REPOSITORY_DIR}/.git" ]]; then
  log "Cloning the deployment repository"
  git clone --single-branch --branch "$DEPLOY_BRANCH" "$REPOSITORY_URL" "$REPOSITORY_DIR"
else
  git -C "$REPOSITORY_DIR" fetch --prune origin \
    "refs/heads/${DEPLOY_BRANCH}:refs/remotes/origin/${DEPLOY_BRANCH}"
fi

target_sha="$(git -C "$REPOSITORY_DIR" rev-parse "refs/remotes/origin/${DEPLOY_BRANCH}")"
if [[ ! "$target_sha" =~ ^[0-9a-f]{40}$ ]]; then
  log "ERROR: GitHub returned an invalid Dev commit"
  exit 1
fi

write_state() {
  local sha="$1"
  local state_tmp="${STATE_FILE}.tmp"
  printf '%s\n' "$sha" > "$state_tmp"
  mv "$state_tmp" "$STATE_FILE"
}

if [[ "$mode" == "--baseline" ]]; then
  write_state "$target_sha"
  log "Baseline recorded for Dev commit ${target_sha}; nothing was deployed"
  exit 0
fi

deployed_sha=""
if [[ -r "$STATE_FILE" ]]; then
  deployed_sha="$(tr -d '[:space:]' < "$STATE_FILE")"
fi
if [[ "$target_sha" == "$deployed_sha" ]] && container_exists "$WEB_CONTAINER"; then
  exit 0
fi

log "Preparing Dev commit ${target_sha}"
git -C "$REPOSITORY_DIR" checkout --force --detach "$target_sha"

if [[ ! -f "${REPOSITORY_DIR}/Dockerfile.preview" ]]; then
  log "ERROR: Dev does not contain Dockerfile.preview"
  exit 1
fi

image="${IMAGE_REPOSITORY}:${target_sha}"
log "Building ${image}"
DOCKER_BUILDKIT=1 docker build \
  --secret "id=web_env,src=${ENV_FILE}" \
  --file "${REPOSITORY_DIR}/Dockerfile.preview" \
  --tag "$image" \
  "$REPOSITORY_DIR"

cleanup_candidate
trap cleanup_candidate EXIT
log "Running candidate health check"
run_web_container "$CANDIDATE_CONTAINER" "$image" 3001 no
if ! wait_for_health 3001; then
  docker logs --tail 100 "$CANDIDATE_CONTAINER" || true
  log "ERROR: candidate health check failed; live site was not changed"
  exit 1
fi
cleanup_candidate

if container_exists "$ROLLBACK_CONTAINER"; then
  if container_exists "$WEB_CONTAINER" && wait_for_health 3000; then
    docker rm --force "$ROLLBACK_CONTAINER" >/dev/null
  else
    log "ERROR: unresolved rollback container exists"
    exit 1
  fi
fi

had_previous=false
if container_exists "$WEB_CONTAINER"; then
  had_previous=true
  docker stop "$WEB_CONTAINER" >/dev/null
  docker rename "$WEB_CONTAINER" "$ROLLBACK_CONTAINER"
fi

log "Starting Dev commit ${target_sha} on port 3000"
if ! run_web_container "$WEB_CONTAINER" "$image" 3000 unless-stopped; then
  if container_exists "$WEB_CONTAINER"; then
    docker rm --force "$WEB_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [[ "$had_previous" == true ]]; then
    docker rename "$ROLLBACK_CONTAINER" "$WEB_CONTAINER"
    docker start "$WEB_CONTAINER" >/dev/null
  fi
  log "ERROR: new web container could not start; rollback restored"
  exit 1
fi

if ! wait_for_health 3000; then
  docker logs --tail 100 "$WEB_CONTAINER" || true
  docker rm --force "$WEB_CONTAINER" >/dev/null 2>&1 || true
  if [[ "$had_previous" == true ]]; then
    docker rename "$ROLLBACK_CONTAINER" "$WEB_CONTAINER"
    docker start "$WEB_CONTAINER" >/dev/null
    wait_for_health 3000 || log "ERROR: rollback container did not become healthy"
  fi
  log "ERROR: live health check failed; rollback restored"
  exit 1
fi

if [[ "$had_previous" == true ]] && container_exists "$ROLLBACK_CONTAINER"; then
  docker rm "$ROLLBACK_CONTAINER" >/dev/null
fi

write_state "$target_sha"
log "Deployment succeeded for ${target_sha}"

