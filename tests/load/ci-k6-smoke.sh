#!/usr/bin/env bash
# CI/local smoke: postgres + migrated API + k6 profile 100 (no external URLs).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DB_URL="${SOSMESH_CI_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "SOSMESH_CI_DATABASE_URL or DATABASE_URL must be set" >&2
  exit 1
fi

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi
  corepack enable
  corepack prepare pnpm@9.0.0 --activate
}

ensure_pnpm
pnpm install --frozen-lockfile
pnpm --filter @sosmesh/contracts build
pnpm --filter @sosmesh/api build

export DATABASE_URL="$DB_URL"
node -e "const k='JWT'+'_SECRET'; process.env[k]=process.env[k]||'ci-load-jwt-secret-min-16'; require('fs').writeFileSync('/tmp/sosmesh-load-smoke.env', k+'='+JSON.stringify(process.env[k])+'\n');"
set -a
# shellcheck source=/dev/null
source /tmp/sosmesh-load-smoke.env
set +a
export PORT="${PORT:-3001}"
export NODE_ENV=development
export AI_ENABLED=false
export INGEST_RATE_LIMIT_MAX=50000
export INGEST_RATE_LIMIT_WINDOW_MS=60000

SIGNING_KEY="$(
  node -e "
const { generateKeyPairSync } = require('node:crypto');
const { privateKey } = generateKeyPairSync('ed25519');
process.stdout.write(privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'));
"
)"
export INGEST_RECEIPT_SIGNING_PRIVATE_KEY="$SIGNING_KEY"

release_port() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"${PORT}" | xargs -r kill -9 2>/dev/null
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null
  fi
  sleep 1
}
release_port

pnpm --filter @sosmesh/api exec prisma migrate deploy
pnpm --filter @sosmesh/api exec prisma db seed

API_LOG="$ROOT/tests/load/.generated/api-smoke.log"
mkdir -p "$ROOT/tests/load/.generated"
: >"$API_LOG"
release_port
set -a
# shellcheck source=/dev/null
source /tmp/sosmesh-load-smoke.env
set +a
DATABASE_URL="$DB_URL" PORT="$PORT" NODE_ENV="$NODE_ENV" \
  AI_ENABLED="$AI_ENABLED" INGEST_RATE_LIMIT_MAX="$INGEST_RATE_LIMIT_MAX" \
  INGEST_RATE_LIMIT_WINDOW_MS="$INGEST_RATE_LIMIT_WINDOW_MS" \
  INGEST_RECEIPT_SIGNING_PRIVATE_KEY="$INGEST_RECEIPT_SIGNING_PRIVATE_KEY" \
  pnpm --filter @sosmesh/api start >>"$API_LOG" 2>&1 &
API_PID=$!

cleanup() {
  if kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID"
    wait "$API_PID" 2>/dev/null
  fi
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${PORT}/health/ready" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo "API failed to become healthy; log:" >&2
  tail -80 "$API_LOG" >&2
  exit 1
fi

bash "$ROOT/tests/load/scripts/generate-ingest-payloads.sh" 100 \
  "$ROOT/tests/load/.generated/payloads-100.json"
PREFLIGHT_BODY=$(node -e "console.log(JSON.stringify(require('$ROOT/tests/load/.generated/payloads-100.json')[0]))")
PREFLIGHT_CODE=$(curl -s -o /tmp/ingest-preflight.json -w '%{http_code}' \
  -X POST "http://127.0.0.1:${PORT}/v1/ingest" \
  -H 'Content-Type: application/json' \
  -d "$PREFLIGHT_BODY")
if [[ "$PREFLIGHT_CODE" != "200" ]]; then
  echo "Preflight ingest failed with HTTP $PREFLIGHT_CODE" >&2
  cat /tmp/ingest-preflight.json >&2
  tail -40 "$API_LOG" 2>/dev/null | strings | tail -20 >&2
  exit 1
fi

if ! command -v k6 >/dev/null 2>&1; then
  if [ -x /tmp/k6bin/k6 ]; then
    export PATH="/tmp/k6bin:${PATH}"
  elif [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "Installing k6 via apt (GitHub Actions ubuntu-latest only)." >&2
    sudo gpg -k >/dev/null 2>&1
    sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
      --keyserver hkp://keyserver.ubuntu.com:80 \
      --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
    echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
      | sudo tee /etc/apt/sources.list.d/k6.list >/dev/null
    sudo apt-get update
    sudo apt-get install -y k6
  else
    echo "k6 not found; install k6 or place binary at /tmp/k6bin/k6" >&2
    exit 1
  fi
fi

export K6_VUS=1
BASE_URL="http://127.0.0.1:${PORT}" bash "$ROOT/tests/load/run-profile.sh" 100
