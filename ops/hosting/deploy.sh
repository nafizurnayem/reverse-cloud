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
readonly IMAGE_REPOSITORY="reverse-cloud-preview"

mode="${1:-deploy}"
if [[ "$mode" != "deploy" && "$mode" != "--force" ]]; then
  printf 'Usage: %s [--force]\n' "$0" >&2
  exit 2
fi

log() {
  printf '%s %s\n' "$(date --iso-8601=seconds)" "$*"
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

cleanup_candidate() {
  if docker container inspect "$CANDIDATE_CONTAINER" >/dev/null 2>&1; then
    docker rm --force "$CANDIDATE_CONTAINER" >/dev/null 2>&1 || true
  fi
}

write_deploy_env() {
  local image="$1"
  local public_origin="$2"
  local temporary="${DEPLOY_ENV}.tmp"
  printf 'WEB_IMAGE=%s\nPUBLIC_ORIGIN=%s\n' "$image" "$public_origin" > "$temporary"
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
if [[ ! -r "$DEPLOY_ENV" ]]; then
  write_deploy_env "${IMAGE_REPOSITORY}:unconfigured" "$public_origin"
fi

export GIT_SSH_COMMAND="ssh -p 443 -o Hostname=ssh.github.com -i ${DEPLOY_KEY} -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes"

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

image="${IMAGE_REPOSITORY}:${target_sha}"
deployed_sha=""
if [[ -r "$STATE_FILE" ]]; then
  deployed_sha="$(tr -d '[:space:]' < "$STATE_FILE")"
fi
live_image="$(docker inspect --format='{{.Config.Image}}' "$WEB_CONTAINER" 2>/dev/null || true)"

if [[ "$mode" != "--force" && "$target_sha" == "$deployed_sha" && "$live_image" == "$image" ]] \
  && wait_for_health 3000; then
  exit 0
fi

log "Preparing ${DEPLOY_BRANCH} commit ${target_sha}"
git -C "$REPOSITORY_DIR" checkout --force --detach "$target_sha"

build_options=(
  --secret "id=web_env,src=${WEB_ENV}"
  --file "${REPOSITORY_DIR}/Dockerfile.preview"
  --tag "$image"
)
if [[ "$mode" == "--force" ]]; then
  build_options+=(--no-cache)
fi

log "Building ${image}"
DOCKER_BUILDKIT=1 docker build "${build_options[@]}" "$REPOSITORY_DIR"

compose up --detach ollama

cleanup_candidate
trap cleanup_candidate EXIT
log "Running candidate health check on port 3001"
docker run --detach \
  --name "$CANDIDATE_CONTAINER" \
  --restart no \
  --network host \
  --mount "type=bind,src=${WEB_ENV},dst=/app/apps/web/.env.local,readonly" \
  --env LOCAL_OLLAMA_PREVIEW=true \
  --env OLLAMA_URL=http://127.0.0.1:11434 \
  --env OLLAMA_MODEL=llama3.2:1b \
  --env "TRUSTED_PUBLIC_ORIGINS=${public_origin}" \
  "$image" \
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

write_deploy_env "$image" "$public_origin"
log "Starting ${target_sha} on port 3000"
if ! compose up --detach --no-deps --force-recreate web || ! wait_for_health 3000; then
  docker logs --tail 100 "$WEB_CONTAINER" || true
  if [[ -r "$previous_env" ]]; then
    cp "$previous_env" "$DEPLOY_ENV"
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
