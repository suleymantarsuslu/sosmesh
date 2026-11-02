#!/usr/bin/env bash
# Generate CycloneDX SBOM for the pnpm monorepo (Linux, no secrets).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required for SBOM generation"
  exit 1
fi

if [ ! -d "$REPO_ROOT/node_modules" ]; then
  pnpm install --frozen-lockfile
fi

node "$SCRIPT_DIR/build-sbom.mjs"

OUT_FILE="$REPO_ROOT/docs/release/sbom.cdx.json"
if [ ! -s "$OUT_FILE" ]; then
  echo "SBOM output missing or empty: $OUT_FILE"
  exit 1
fi
