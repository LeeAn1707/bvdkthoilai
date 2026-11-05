#!/usr/bin/env bash
# Forced SSH command: expose only deploy of a 40-hex commit; no shell access.
set -Eeuo pipefail
request="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$request" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  exec sudo -n /usr/local/sbin/bvdk-deploy-ghcr.sh "${BASH_REMATCH[1]}"
fi
printf 'DENIED: only deploy <40-hex-commit> is permitted\n' >&2
exit 126
