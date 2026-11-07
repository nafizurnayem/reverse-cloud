#!/usr/bin/env bash
set -Eeuo pipefail

readonly SERVER="${REVERSE_CLOUD_SERVER:-nafz@192.168.6.34}"
readonly SSH_KEY="${REVERSE_CLOUD_SSH_KEY:-/home/nafiz/.ssh/satellite_c50_hosting}"

exec ssh \
  -i "$SSH_KEY" \
  -o BatchMode=yes \
  -o ConnectTimeout=10 \
  "$SERVER" \
  "docker logs --follow --tail 200 --timestamps reverse-cloud-web 2>&1 | grep --line-buffered '\[activity\]'"
