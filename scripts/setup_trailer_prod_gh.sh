#!/usr/bin/env bash
set -euo pipefail

# One-shot setup helper for trailer prod automation.
# - sets git remote (optional)
# - configures GitHub secrets
# - optionally triggers workflow dispatch

REPO_DIR="${REPO_DIR:-/home/edenilson/trailers-motorshome}"
REMOTE_URL="${REMOTE_URL:-}"
RUN_DISPATCH="${RUN_DISPATCH:-0}"
WORKFLOW_FILE=".github/workflows/trailer-prod-deploy.yml"

: "${TRAILER_PROD_HOST:?TRAILER_PROD_HOST is required}"
: "${TRAILER_PROD_SSH_USER:?TRAILER_PROD_SSH_USER is required}"
: "${TRAILER_PROD_SSH_PORT:?TRAILER_PROD_SSH_PORT is required}"

if [[ ! -f "${REPO_DIR}/${WORKFLOW_FILE}" ]]; then
  echo "Workflow not found at ${REPO_DIR}/${WORKFLOW_FILE}"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh auth is not configured"
  exit 1
fi

if [[ -n "${REMOTE_URL}" ]]; then
  if git -C "${REPO_DIR}" remote get-url origin >/dev/null 2>&1; then
    git -C "${REPO_DIR}" remote set-url origin "${REMOTE_URL}"
  else
    git -C "${REPO_DIR}" remote add origin "${REMOTE_URL}"
  fi
fi

if ! git -C "${REPO_DIR}" remote get-url origin >/dev/null 2>&1; then
  echo "No origin remote configured. Set REMOTE_URL and run again."
  exit 1
fi

ORIGIN_URL="$(git -C "${REPO_DIR}" remote get-url origin)"
REPO_SLUG="$(printf '%s' "${ORIGIN_URL}" | perl -pe 's#^(git\@github.com:|https://github.com/)##; s#\.git$##')"

echo "Setting repository secrets..."
gh secret set TRAILER_PROD_HOST --body "${TRAILER_PROD_HOST}" --repo "${REPO_SLUG}"
gh secret set TRAILER_PROD_SSH_USER --body "${TRAILER_PROD_SSH_USER}" --repo "${REPO_SLUG}"
gh secret set TRAILER_PROD_SSH_PORT --body "${TRAILER_PROD_SSH_PORT}" --repo "${REPO_SLUG}"

if [[ -n "${TRAILER_PROD_SSH_KEY_FILE:-}" ]]; then
  gh secret set TRAILER_PROD_SSH_KEY < "${TRAILER_PROD_SSH_KEY_FILE}" --repo "${REPO_SLUG}"
elif [[ -n "${TRAILER_PROD_SSH_KEY:-}" ]]; then
  gh secret set TRAILER_PROD_SSH_KEY --body "${TRAILER_PROD_SSH_KEY}" --repo "${REPO_SLUG}"
else
  echo "Missing SSH key: set TRAILER_PROD_SSH_KEY_FILE or TRAILER_PROD_SSH_KEY"
  exit 1
fi

echo "Secrets configured."

if [[ "${RUN_DISPATCH}" == "1" ]]; then
  echo "Triggering workflow dispatch..."
  gh workflow run "$(basename "${WORKFLOW_FILE}")" --repo "${REPO_SLUG}"
fi

echo "Done."
