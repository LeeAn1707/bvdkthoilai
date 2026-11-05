#!/usr/bin/env bash
# One-time preparation (does not restart Docker, modify Nginx, or change DB/media).
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 ]] || { echo 'Run this as root on VPS'; exit 1; }
cd /opt/bvdkthoilai

EXPECTED_SHA=2fa0e4680cb083bab94835bfed62d92fbc9e584a
EXPECTED_IMAGE=sha256:8d75a9f16deea843cc0916fe80d6cd40b34b5771b8540701864eb989aac96cc5
CURRENT_IMAGE="$(docker inspect --format '{{.Image}}' bvdkthoilai-app-1)"
[[ "$CURRENT_IMAGE" == "$EXPECTED_IMAGE" ]] || {
  echo "STOP: running app image changed since last verification: $CURRENT_IMAGE" >&2
  exit 1
}
[[ "$(docker inspect --format '{{.Config.Image}}' bvdkthoilai-db-1)" == 'postgres:18-alpine' ]] || {
  echo 'STOP: unexpected PostgreSQL version' >&2; exit 1;
}
docker compose config --quiet
[[ -x /usr/local/sbin/bvdk-backup.sh ]] || { echo 'STOP: backup script missing'; exit 1; }
command -v visudo >/dev/null || { echo 'STOP: sudo/visudo not installed'; exit 1; }

install -d -m 700 -o root -g root /var/lib/bvdk-deploy
if [[ ! -e /var/lib/bvdk-deploy/current-sha ]]; then
  printf '%s\n' "$EXPECTED_SHA" > /var/lib/bvdk-deploy/current-sha
  chmod 600 /var/lib/bvdk-deploy/current-sha
fi

install -o root -g root -m 700 ops/bvdk-deploy-ghcr.sh /usr/local/sbin/bvdk-deploy-ghcr.sh
install -o root -g root -m 755 ops/bvdk-deploy-gate.sh /usr/local/sbin/bvdk-deploy-gate.sh

if ! id bvdkdeploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash bvdkdeploy
  passwd -l bvdkdeploy >/dev/null
fi
install -d -m 700 -o bvdkdeploy -g bvdkdeploy /home/bvdkdeploy/.ssh

key=/root/.ssh/bvdk-gha-production-ed25519
install -d -m 700 -o root -g root /root/.ssh
if [[ ! -f "$key" ]]; then
  ssh-keygen -q -t ed25519 -N '' -C 'bvdk-github-actions-deploy-only' -f "$key"
fi
[[ -s "$key.pub" ]] || { echo 'Missing SSH public key'; exit 1; }

printf 'restrict,command="/usr/local/sbin/bvdk-deploy-gate.sh" %s\n' "$(cat "$key.pub")" \
  > /home/bvdkdeploy/.ssh/authorized_keys
chown bvdkdeploy:bvdkdeploy /home/bvdkdeploy/.ssh/authorized_keys
chmod 600 /home/bvdkdeploy/.ssh/authorized_keys

sudoers_file=/etc/sudoers.d/bvdkdeploy
printf '%s\n' 'bvdkdeploy ALL=(root) NOPASSWD: /usr/local/sbin/bvdk-deploy-ghcr.sh *' > "$sudoers_file"
chmod 440 "$sudoers_file"
visudo -cf "$sudoers_file"

printf '\nSETUP_CD_READY\n'
printf 'Production state: %s\n' "$(cat /var/lib/bvdk-deploy/current-sha)"
printf 'Private key file (DO NOT SHARE IN CHAT): %s\n' "$key"
printf 'Public VPS host key for GitHub known_hosts secret:\n'
awk '{print $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub
printf 'Next: configure GitHub environment, SSH secrets/variables, then commit workflow.\n'
