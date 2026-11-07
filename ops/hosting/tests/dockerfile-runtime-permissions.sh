#!/usr/bin/env bash
set -Eeuo pipefail

dockerfile="${1:-Dockerfile.preview}"

if [[ ! -f "$dockerfile" ]]; then
  printf 'FAIL: Dockerfile not found: %s\n' "$dockerfile" >&2
  exit 1
fi

# The deploy checkout is created under umask 077, so COPY preserves source
# files as owner-only. Runtime files should remain root-owned but readable by
# the final non-root user.
if ! grep -Eq \
  "^RUN[[:space:]]+find[[:space:]]+/app.*node_modules.*-prune.*chmod[[:space:]]+a\\+r.*$" \
  "$dockerfile"; then
  printf '%s\n' 'FAIL: /app permissions are not normalized for the runtime user' >&2
  exit 1
fi

if ! grep -Eq '^USER[[:space:]]+node[[:space:]]*$' "$dockerfile"; then
  printf '%s\n' 'FAIL: the final image must run as the non-root node user' >&2
  exit 1
fi

printf '%s\n' 'PASS: root-owned application files are readable by the non-root runtime'
