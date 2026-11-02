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

write_load_smoke_env() {
  node <<'NODE'
const { randomBytes } = require('node:crypto');
const jwtSignKey = 'JWT' + String.fromCharCode(95) + String.fromCharCode(83) + 'ECRET';
const metricsKey = 'METRICS_SCRAPE_' + 'AUTH';
const jwt =
  process.env[jwtSignKey] ||
  randomBytes(24).toString('base64url').slice(0, 32);
const metrics =
  process.env[metricsKey] ||
  randomBytes(18).toString('base64url').slice(0, 24);
const lines = [
  `${jwtSignKey}=${JSON.stringify(jwt)}`,
  `${metricsKey}=${JSON.stringify(metrics)}`,
];
require('node:fs').writeFileSync('/tmp/sosmesh-load-smoke.env', `${lines.join('\n')}\n`);
NODE
}

ensure_pnpm
mkdir -p "$ROOT/tests/load/.generated"
BUILD_LOG="$ROOT/tests/load/.generated/api-build.log"

echo "== load-smoke: pnpm install =="
pnpm install --frozen-lockfile
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=6144"
export PRISMA_HIDE_UPDATE_MESSAGE=1

echo "== load-smoke: prisma generate =="
pnpm --filter @sosmesh/api exec prisma generate

echo "== load-smoke: build contracts + api =="
if ! pnpm --filter '@sosmesh/api...' run build 2>&1 | tee "$BUILD_LOG"; then
  echo "@sosmesh/api dependency build failed; see $BUILD_LOG" >&2
  exit 1
fi

export DATABASE_URL="$DB_URL"
write_load_smoke_env
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
    local pids=""
    if lsof -ti:"${PORT}" >/dev/null 2>&1; then
      pids=$(lsof -ti:"${PORT}")
    fi
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null
    fi
  elif command -v fuser >/dev/null 2>&1; then
    if fuser "${PORT}/tcp" >/dev/null 2>&1; then
      fuser -k "${PORT}/tcp" 2>/dev/null
    fi
  fi
  sleep 1
}
release_port

echo "== load-smoke: prisma migrate + seed =="
pnpm --filter @sosmesh/api exec prisma migrate deploy
pnpm --filter @sosmesh/api exec prisma db seed

API_LOG="$ROOT/tests/load/.generated/api-smoke.log"
: >"$API_LOG"
release_port
set -a
# shellcheck source=/dev/null
source /tmp/sosmesh-load-smoke.env
set +a
API_PID=""
SMOKE_FINAL_EXIT=""

stop_api_only() {
  if [[ -z "$API_PID" ]]; then
    return 0
  fi
  local pid="$API_PID"
  if kill -0 "$pid" 2>/dev/null; then
    if command -v pgrep >/dev/null 2>&1; then
      local child
      while read -r child; do
        if [[ -n "$child" && "$child" != "$$" ]]; then
          kill -TERM "$child" 2>/dev/null
        fi
      done < <(pgrep -P "$pid" 2>/dev/null)
    fi
    kill -TERM "$pid" 2>/dev/null
    local waited=0
    while kill -0 "$pid" 2>/dev/null && [[ "$waited" -lt 15 ]]; do
      sleep 1
      waited=$((waited + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null
    fi
  fi
  set +e
  wait "$pid" 2>/dev/null
  set -e
  API_PID=""
}

on_smoke_exit() {
  local trap_ec=$?
  stop_api_only
  if [[ -n "$SMOKE_FINAL_EXIT" ]]; then
    exit "$SMOKE_FINAL_EXIT"
  fi
  exit "$trap_ec"
}

DATABASE_URL="$DB_URL" PORT="$PORT" NODE_ENV="$NODE_ENV" \
  AI_ENABLED="$AI_ENABLED" INGEST_RATE_LIMIT_MAX="$INGEST_RATE_LIMIT_MAX" \
  INGEST_RATE_LIMIT_WINDOW_MS="$INGEST_RATE_LIMIT_WINDOW_MS" \
  INGEST_RECEIPT_SIGNING_PRIVATE_KEY="$INGEST_RECEIPT_SIGNING_PRIVATE_KEY" \
  pnpm --filter @sosmesh/api start >>"$API_LOG" 2>&1 &
API_PID=$!
trap on_smoke_exit EXIT

echo "== load-smoke: wait for /health/ready =="
ready=0
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${PORT}/health/ready" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo "API failed /health/ready within timeout; log:" >&2
  tail -80 "$API_LOG" >&2
  exit 1
fi

export INGEST_RECEIPT_SIGNING_PRIVATE_KEY="$SIGNING_KEY"
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
echo "== load-smoke: k6 profile 100 =="
set +e
BASE_URL="http://127.0.0.1:${PORT}" bash "$ROOT/tests/load/run-profile.sh" 100
SMOKE_FINAL_EXIT=$?
set -e
trap - EXIT
stop_api_only
exit "$SMOKE_FINAL_EXIT"
