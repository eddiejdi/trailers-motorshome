#!/usr/bin/env bash
set -euo pipefail

# Atomic publish for trailer frontend (static files only).
# Intended to run on the production server.

APP_USER="${APP_USER:-trailerapp}"
APP_GROUP="${APP_GROUP:-www-data}"
APP_BASE="${APP_BASE:-/srv/trailer-app}"
SITE_ROOT="${SITE_ROOT:-/var/www/rpa4all.com/trailer}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

if [[ "$#" -lt 1 ]]; then
  echo "Usage: $0 <artifact_tar_gz>"
  exit 2
fi

ARTIFACT="$1"
if [[ ! -f "${ARTIFACT}" ]]; then
  echo "Artifact not found: ${ARTIFACT}"
  exit 1
fi

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  echo "Missing app user: ${APP_USER}. Run bootstrap first."
  exit 1
fi

RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
RELEASE_DIR="${APP_BASE}/releases/${RELEASE_ID}"
CURRENT_LINK="${APP_BASE}/current"

mkdir -p "${RELEASE_DIR}"
tar -xzf "${ARTIFACT}" -C "${RELEASE_DIR}"

if [[ ! -f "${RELEASE_DIR}/index.html" ]]; then
  echo "Invalid artifact: index.html missing"
  rm -rf "${RELEASE_DIR}"
  exit 1
fi

chown -R "${APP_USER}:${APP_GROUP}" "${RELEASE_DIR}"
chmod -R g+rX "${RELEASE_DIR}"

ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"

mkdir -p "${SITE_ROOT}"
rsync -a --delete "${CURRENT_LINK}/" "${SITE_ROOT}/"
chown -R "${APP_USER}:${APP_GROUP}" "${SITE_ROOT}"
chmod -R g+rX "${SITE_ROOT}"

# Keep only N last releases
mapfile -t releases < <(ls -1dt "${APP_BASE}/releases"/* 2>/dev/null || true)
if (( ${#releases[@]} > KEEP_RELEASES )); then
  for old in "${releases[@]:KEEP_RELEASES}"; do
    rm -rf "${old}"
  done
fi

echo "Published release ${RELEASE_ID} to ${SITE_ROOT}"
