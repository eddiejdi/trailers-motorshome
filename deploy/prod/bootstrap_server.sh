#!/usr/bin/env bash
set -euo pipefail

# Idempotent bootstrap for trailer production hosting.
# Run as root (or via sudo) on the production server.

APP_USER="${APP_USER:-trailerapp}"
APP_GROUP="${APP_GROUP:-www-data}"
APP_BASE="${APP_BASE:-/srv/trailer-app}"
PUBLISH_BIN="/usr/local/sbin/trailer-prod-publish"

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must run as root."
  exit 1
fi

if ! getent group "${APP_GROUP}" >/dev/null; then
  echo "Group ${APP_GROUP} does not exist."
  exit 1
fi

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd \
    --system \
    --shell /usr/sbin/nologin \
    --no-create-home \
    --gid "${APP_GROUP}" \
    "${APP_USER}"
fi

mkdir -p "${APP_BASE}/releases" "${APP_BASE}/shared"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_BASE}"
chmod 2755 "${APP_BASE}" "${APP_BASE}/releases" "${APP_BASE}/shared"

if [[ ! -L "${APP_BASE}/current" ]]; then
  ln -sfn "${APP_BASE}/releases" "${APP_BASE}/current"
fi

install -d -m 0755 /usr/local/sbin
if [[ -f ./deploy/prod/publish_release.sh ]]; then
  install -m 0755 ./deploy/prod/publish_release.sh "${PUBLISH_BIN}"
fi

echo "Bootstrap done:"
echo "- app user: ${APP_USER}"
echo "- app base: ${APP_BASE}"
echo "- publish helper: ${PUBLISH_BIN}"
