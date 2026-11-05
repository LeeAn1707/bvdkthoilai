#!/usr/bin/env bash
# BVDK safe application-only GHCR deployment; run as root via restricted SSH sudo.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0

REPO_DIR=/opt/bvdkthoilai
STATE_DIR=/var/lib/bvdk-deploy
STATE_FILE="$STATE_DIR/current-sha"
APP_CONTAINER=bvdkthoilai-app-1
DB_CONTAINER=bvdkthoilai-db-1
LOCAL_IMAGE=bvdkthoilai-app:latest

fatal() { printf 'DEPLOY_FAILED: %s\n' "$*" >&2; exit 1; }
info() { printf '[BVDK-CD] %s\n' "$*"; }

[[ "$(id -u)" == 0 ]] || fatal 'Must run as root'
[[ $# == 1 && "$1" =~ ^[0-9a-f]{40}$ ]] || fatal 'Requires one 40-hex commit SHA'
TARGET_SHA="$1"
TARGET_IMAGE="ghcr.io/leean1707/bvdkthoilai:sha-$TARGET_SHA"

# Prevent competing deployments (and accidental double approval).
exec 9>/run/lock/bvdk-deploy.lock
flock -n 9 || fatal 'Another production deployment is running'

cd "$REPO_DIR" || fatal "Missing $REPO_DIR"
[[ -s "$STATE_FILE" ]] || fatal "Uninitialized $STATE_FILE; run setup first"
[[ -x /usr/local/sbin/bvdk-backup.sh ]] || fatal 'Verified backup script unavailable'
docker compose config --quiet || fatal 'Invalid local Docker Compose configuration'

CURRENT_SHA="$(cat "$STATE_FILE")"
[[ "$CURRENT_SHA" =~ ^[0-9a-f]{40}$ ]] || fatal 'Invalid previously deployed SHA'
CURRENT_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$APP_CONTAINER")" || fatal 'App container missing'
[[ "$(docker inspect --format '{{.Config.Image}}' "$DB_CONTAINER")" == 'postgres:18-alpine' ]] \
  || fatal 'Unexpected DB image; refusing to deploy'
[[ "$(docker inspect --format '{{.State.Running}}' "$DB_CONTAINER")" == 'true' ]] \
  || fatal 'Database is not running'
DB_CONTAINER_ID="$(docker inspect --format '{{.Id}}' "$DB_CONTAINER")"

# Fail closed if the persistent media mount is missing.
MEDIA_MOUNT="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/media"}}{{println .Name}}{{end}}{{end}}' "$APP_CONTAINER")"
[[ -n "$MEDIA_MOUNT" ]] || fatal '/app/media named volume missing'

# Ensure only the current main commit is deployed, not a stale approval.
REMOTE_MAIN="$(git -c credential.helper= ls-remote origin refs/heads/main | awk '{print $1}')"
[[ "$REMOTE_MAIN" == "$TARGET_SHA" ]] \
  || fatal "Stale or non-main deployment request: target=$TARGET_SHA main=$REMOTE_MAIN"

# Fetch only Git objects. Do NOT pull, merge, checkout, or overwrite local production Compose/.env.
git -c credential.helper= fetch --no-tags origin "$TARGET_SHA" >/dev/null
git cat-file -e "${CURRENT_SHA}^{commit}" || fatal 'Recorded current commit not found locally'
git cat-file -e "${TARGET_SHA}^{commit}" || fatal 'Target commit not found locally'
git merge-base --is-ancestor "$CURRENT_SHA" "$TARGET_SHA" \
  || fatal 'Target is not a fast-forward successor of deployed commit'

# Protect database/runtime changes: these require a separate, explicit migration review.
RISK_FILES="$(git diff --name-only "$CURRENT_SHA" "$TARGET_SHA" -- \
  src/migrations migrations docker-compose.yml compose.yml compose.yaml Dockerfile \
  src/payload.config.ts src/payload.config.js src/collections src/globals \
  package.json package-lock.json scripts/db-migrate.mjs \
  scripts/apply-changelog-migrations.mjs scripts/migrate.ts scripts/migrate.mjs)"
if [[ -n "$RISK_FILES" ]]; then
  printf 'MANUAL_REVIEW_REQUIRED: deployment includes DB/infra-sensitive files:\n%s\n' "$RISK_FILES" >&2
  exit 2
fi

if [[ "$TARGET_SHA" == "$CURRENT_SHA" ]]; then
  info "Commit $TARGET_SHA is already recorded as deployed; no restart needed"
  exit 0
fi

# Confirm a successful backup before changing the running app.
info "Pulling commit-specific GHCR tag: $TARGET_IMAGE"
docker pull "$TARGET_IMAGE"
TARGET_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$TARGET_IMAGE")"

backup_output="$(mktemp)"
trap 'rm -f "$backup_output"' EXIT
info 'Creating verified pre-deployment DB + media backup'
if ! /usr/local/sbin/bvdk-backup.sh >"$backup_output" 2>&1; then
  tail -n 20 "$backup_output" >&2
  fatal 'Pre-deployment backup failed'
fi
if ! grep -q 'BACKUP_SUCCESS' "$backup_output"; then
  tail -n 20 "$backup_output" >&2
  fatal 'Pre-deployment backup did not report BACKUP_SUCCESS'
fi
info 'BACKUP_SUCCESS confirmed'

# Refuse an approval which became stale while a potentially long backup ran.
REMOTE_MAIN_AFTER_BACKUP="$(git -c credential.helper= ls-remote origin refs/heads/main | awk '{print $1}')"
[[ "$REMOTE_MAIN_AFTER_BACKUP" == "$TARGET_SHA" ]] || fatal 'Newer main commit detected during backup; deployment canceled'

write_state() {
  local state_tmp="$STATE_DIR/current-sha.tmp.$$"
  printf '%s\n' "$TARGET_SHA" > "$state_tmp"
  chmod 600 "$state_tmp"
  mv -f "$state_tmp" "$STATE_FILE"
}

if [[ "$TARGET_IMAGE_ID" == "$CURRENT_IMAGE_ID" ]]; then
  info 'New image is byte-identical to running image; recording SHA only'
  write_state
  exit 0
fi

ROLLBACK_TAG="bvdkthoilai-app:rollback-$(date -u +%Y%m%dT%H%M%SZ)"
docker image tag "$CURRENT_IMAGE_ID" "$ROLLBACK_TAG"
info "Rollback image preserved as $ROLLBACK_TAG"

wait_for_health() {
  local i status
  for ((i=1; i<=36; i++)); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$APP_CONTAINER" 2>/dev/null || true)"
    if [[ "$status" == healthy ]] && \
       curl -fsS --max-time 8 -o /dev/null http://127.0.0.1:3000/api/health && \
       curl -fsS --max-time 10 -o /dev/null https://bvdkthoilai.vn/api/health; then
      return 0
    fi
    sleep 5
  done
  return 1
}

rollback() {
  info "Attempting app-only rollback to $CURRENT_IMAGE_ID"
  docker image tag "$CURRENT_IMAGE_ID" "$LOCAL_IMAGE" || return 1
  docker compose up -d --no-deps --no-build --force-recreate app || return 1
  if wait_for_health; then
    info 'ROLLBACK_OK: previous app restored, DB and media volumes unchanged'
    return 0
  fi
  info 'ROLLBACK_UNHEALTHY: urgent operator intervention required'
  return 1
}

info 'Recreating only app container using tested GHCR image'
docker image tag "$TARGET_IMAGE_ID" "$LOCAL_IMAGE"
if ! docker compose up -d --no-deps --no-build --force-recreate app; then
  info 'App recreation failed'
  rollback || true
  fatal 'Docker Compose app recreation failed'
fi

if [[ "$(docker inspect --format '{{.Id}}' "$DB_CONTAINER")" != "$DB_CONTAINER_ID" ]]; then
  info 'Unexpected database container identity change'
  rollback || true
  fatal 'Database container changed during app-only deployment'
fi

if [[ "$(docker inspect --format '{{.Image}}' "$APP_CONTAINER")" != "$TARGET_IMAGE_ID" ]]; then
  info 'Running app image does not match selected GHCR image'
  rollback || true
  fatal 'Deployment image mismatch'
fi

if ! wait_for_health; then
  info 'New app did not pass container, local and public health checks'
  docker compose logs --since=5m --tail=60 app || true
  rollback || true
  fatal 'Health check failed; rollback attempted. Inspect VPS immediately.'
fi

# The health gate passed. Recording only the commit; never modify DB or media volumes.
write_state
info "DEPLOY_SUCCESS: commit=$TARGET_SHA image_id=$TARGET_IMAGE_ID"
info 'Smoke-test homepage, specialty save, and media upload separately'
