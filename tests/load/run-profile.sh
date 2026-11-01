#!/usr/bin/env bash
# Run k6 load profiles against LOCAL API only. Profiles 1000/10000 are manual (ERTELENDİ in CI).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="${1:-100}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
bash "$ROOT/tests/load/scripts/assert-local-base-url.sh" "$BASE_URL"

if [[ "$PROFILE" != "100" && "$PROFILE" != "1000" && "$PROFILE" != "10000" ]]; then
  echo "Usage: $0 [100|1000|10000]" >&2
  exit 1
fi

mkdir -p "$ROOT/tests/load/.generated"

if [[ "$PROFILE" == "100" && -f "$ROOT/tests/load/.generated/payloads-100.json" ]]; then
  PAYLOAD_FILE="$ROOT/tests/load/.generated/payloads-100.json"
else
  bash "$ROOT/tests/load/scripts/generate-ingest-payloads.sh" "$PROFILE" \
    "$ROOT/tests/load/.generated/payloads-${PROFILE}.json"
  PAYLOAD_FILE="$ROOT/tests/load/.generated/payloads-${PROFILE}.json"
fi

if ! command -v k6 >/dev/null 2>&1; then
  if [ -x /tmp/k6bin/k6 ]; then
    export PATH="/tmp/k6bin:${PATH}"
  fi
fi
if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed. Install from https://grafana.com/docs/k6/latest/set-up/install-k6/" >&2
  exit 1
fi

export PAYLOAD_FILE
export PROFILE_SIZE="$PROFILE"
export BASE_URL
export K6_SUMMARY_JSON="$ROOT/tests/load/.generated/k6-summary-${PROFILE}.json"

k6 run "$ROOT/tests/load/k6/sos-ingest.js"

echo "Summary written to $K6_SUMMARY_JSON"
