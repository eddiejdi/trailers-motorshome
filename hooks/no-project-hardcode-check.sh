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
  "src/services/PaletteService.js"
  "src/services/WeightService.js"
  "src/services/SaveService.js"
  "src/services/EditorService.js"
  "index.html"
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
  # Anti-regressão: paleta é data-driven (data/palette-catalog.json)
  "PALLET_DATA\s*=\s*\{"
  "PALETTE_WEIGHTS\s*=\s*\{"
  "PALLET_DATA\["
  "PALETTE_WEIGHTS\["
  "data-item=\"[a-z0-9_-]+\""
  # HOOK coords absolutas: nunca reintroduzir offset de piso no interior
  "interior\.position\.y\s*=\s*FLOOR_Y"
  "interior\.position\.y\s*=\s*this\.FLOOR_Y"
  "position\.y\s*\+=\s*FLOOR_Y"
  "position\.y\s*\+=\s*floorY\s*-\s*b\.min\.y"
)

for pattern in "${PATTERNS[@]}"; do
  if printf '%s\n' "$DIFF" | grep -Eq "^\+[^+].*${pattern}"; then
    printf '%s\n' "[HOOK] Bloqueado: hardcode de projeto detectado (${pattern})." >&2
    printf '%s\n' "Edite o JSON do projeto (geometry/scene_layout/structure), nao o motor da ferramenta." >&2
    exit 1
  fi
done

exit 0
