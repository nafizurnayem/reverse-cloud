#!/usr/bin/env bash
set -Eeuo pipefail

readonly STATE_DIR="${REVERSE_CLOUD_HOSTING_ROOT:-/home/nafz/reverse-cloud-hosting}/state"
readonly LOCK_FILE="${STATE_DIR}/tunnel-watchdog.lock"

mkdir -p "$STATE_DIR"
exec 9>"$LOCK_FILE"
flock --nonblock 9 || exit 0

connection_count() {
  local metrics_port="$1"
  curl --fail --silent --show-error --max-time 3 \
    "http://127.0.0.1:${metrics_port}/metrics" 2>/dev/null \
    | awk '/^cloudflared_tunnel_ha_connections / { print $2; exit }'
}

connector_is_healthy() {
  local metrics_port="$1"
  local count
  count="$(connection_count "$metrics_port" || true)"
  [[ "$count" =~ ^[0-9]+$ ]] && (( count > 0 ))
}

repair_connector() {
  local container="$1"
  local metrics_port="$2"

  connector_is_healthy "$metrics_port" && return 0
  sleep 10
  connector_is_healthy "$metrics_port" && return 0

  printf '%s restarting %s after two zero-connection checks\n' \
    "$(date --iso-8601=seconds)" "$container"
  docker restart "$container" >/dev/null
}

repair_connector reverse-cloud-tunnel 2000
repair_connector reverse-cloud-tunnel-fallback 2001
