#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    console.error("Node.js 22.13 or newer is required.");
    process.exit(1);
  }
'
npm ci
if [[ ! -e .env.local ]]; then
  cp -n .env.example .env.local
fi
bash scripts/start-local.sh --check
echo "Setup complete. Run npm run demo to start."
