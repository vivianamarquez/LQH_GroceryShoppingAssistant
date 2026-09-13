#!/usr/bin/env bash
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${LLAMA_SERVER_BIN:-$DEMO_DIR/.runtime/llama/build/bin/llama-server}"
MODELS="$DEMO_DIR/../../models"

if [[ ! -x "$BIN" ]]; then
  echo "llama-server not found. See $DEMO_DIR/README.md."
  exit 1
fi

for model in grocery-list-v3-q4.gguf LFM2.5-1.2B-Instruct-Q4_K_M.gguf; do
  if [[ ! -r "$MODELS/$model" ]]; then
    echo "Model not found: $MODELS/$model. See $DEMO_DIR/README.md."
    exit 1
  fi
done

mkdir -p "$DEMO_DIR/.runtime/logs"
"$BIN" -m "$MODELS/grocery-list-v3-q4.gguf" --port 8080 -ngl 99 -c 4096 > "$DEMO_DIR/.runtime/logs/tuned.log" 2>&1 &
TUNED_PID=$!
"$BIN" -m "$MODELS/LFM2.5-1.2B-Instruct-Q4_K_M.gguf" --port 8082 -ngl 99 -c 4096 > "$DEMO_DIR/.runtime/logs/base.log" 2>&1 &
BASE_PID=$!

trap 'kill "$TUNED_PID" "$BASE_PID" 2>/dev/null || true' EXIT INT TERM
cd "$DEMO_DIR"
npm run dev
