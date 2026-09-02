#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
JOURNAL_PATH="$ROOT_DIR/command-journal.json"
LEARNING_LOG_PATH="$ROOT_DIR/docs/ai/learning-log.jsonl"

if [ "${1:-}" = "" ]; then
  if [ -t 0 ]; then
    echo "Uso: $0 \"comando para o trailer\"" >&2
    echo "Ou:  echo \"comando\" | $0" >&2
    exit 1
  fi
  CMD_TEXT="$(cat)"
else
  CMD_TEXT="$*"
fi

CMD_TEXT="$(printf '%s' "$CMD_TEXT" | tr -s ' ' | sed 's/^ *//;s/ *$//')"
if [ -z "$CMD_TEXT" ]; then
  echo "Comando vazio, nada salvo." >&2
  exit 1
fi

python3 - "$JOURNAL_PATH" "$LEARNING_LOG_PATH" "$CMD_TEXT" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

journal_path = sys.argv[1]
learning_log_path = sys.argv[2]
cmd_text = sys.argv[3]
ts = datetime.now(timezone.utc).isoformat()

def classify(text):
    t = text.lower()
    tags = []
    if any(w in t for w in ["parede", "mezanino", "teto", "telhado", "cambao", "geometr"]):
        tags.extend(["geometry", "trailer"])
    if any(w in t for w in ["walk", "entrar", "wasd", "mao", "mãos", "mouse"]):
        tags.extend(["walkthrough", "input"])
    if any(w in t for w in ["erro", "errado", "falha", "bug", "nao", "não"]):
        typ = "mistake-or-correction"
    else:
        typ = "request"
    if not tags:
        tags.append("user-request")
    return typ, sorted(set(tags))

event_type, tags = classify(cmd_text)

entry = {
    "ts": ts,
    "text": cmd_text,
    "source": "external-hook",
    "status": "requested",
}

data = []
if os.path.exists(journal_path):
    try:
        with open(journal_path, "r", encoding="utf-8") as f:
            parsed = json.load(f)
            if isinstance(parsed, list):
                data = parsed
    except Exception:
        data = []

data.append(entry)
if len(data) > 1000:
    data = data[-1000:]

with open(journal_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

os.makedirs(os.path.dirname(learning_log_path), exist_ok=True)
last_id = 0
if os.path.exists(learning_log_path):
    with open(learning_log_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                last_id = max(last_id, int(json.loads(line).get("id", 0)))
            except Exception:
                pass

learning_entry = {
    "id": last_id + 1,
    "ts": ts,
    "area": "trailer-3d",
    "type": event_type,
    "source": "external-hook",
    "user_request": cmd_text,
    "status": "captured",
    "tags": tags,
    "confidence": "medium",
}
with open(learning_log_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(learning_entry, ensure_ascii=False) + "\n")

print(f"Comando salvo em {journal_path}")
print(f"Aprendizado salvo em {learning_log_path}")
PY
