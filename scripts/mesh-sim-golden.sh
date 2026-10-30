#!/usr/bin/env bash
# Golden mesh lab trace + chaos test suite (ADIM 11)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

pnpm --filter @sosmesh/mesh-simulator build
pnpm --filter @sosmesh/chaos-tests test --reporter=verbose

GOLDEN="$REPO_ROOT/tools/mesh-simulator/golden/example-trace-seed4242.json"
SCHEMA="$REPO_ROOT/tools/mesh-simulator/schemas/mesh-trace-v1.schema.json"

if [ ! -f "$GOLDEN" ]; then
  echo "Missing golden trace: $GOLDEN"
  exit 1
fi

if [ ! -f "$SCHEMA" ]; then
  echo "Missing schema: $SCHEMA"
  exit 1
fi

node "$SCRIPT_DIR/mesh-sim-validate-golden.js"

echo "mesh-sim-golden: OK"
