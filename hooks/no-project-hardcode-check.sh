#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

TARGETS=(
  "src/main.js"
  "src/model/Body.js"
  "src/model/Interior.js"
  "src/model/Windows.js"
  "src/constants/Dimensions.js"
)

DIFF="$(git diff --cached --unified=0 -- "${TARGETS[@]}" || true)"
if [ -z "$DIFF" ]; then
  exit 0
fi

PATTERNS=(
  "_upsertUnderfloorTanksIntoProjectJson"
  "Caixa água 100L \(limpa\)"
  "Caixa detrito 100L"
  "CABIN_RISE"
  "cabinRise"
  "geometry\.kind"
  "geometry\.projectType"
)

for pattern in "${PATTERNS[@]}"; do
  if printf '%s\n' "$DIFF" | grep -Eq "^\+[^+].*${pattern}"; then
    printf '%s\n' "[HOOK] Bloqueado: hardcode de projeto detectado (${pattern})." >&2
    printf '%s\n' "Edite o JSON do projeto (geometry/scene_layout/structure), nao o motor da ferramenta." >&2
    exit 1
  fi
done

exit 0
