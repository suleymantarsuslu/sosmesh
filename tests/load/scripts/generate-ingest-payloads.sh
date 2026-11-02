#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COUNT="${1:-100}"
OUT="${2:-$ROOT/tests/load/.generated/payloads-${COUNT}.json}"

mkdir -p "$(dirname "$OUT")"
cd "$ROOT/apps/api"
pnpm exec ts-node --project tsconfig.json --transpile-only "../../tests/load/scripts/generate-ingest-payloads.ts" "$COUNT" "$OUT"
