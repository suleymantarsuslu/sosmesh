#!/usr/bin/env bash
# Container smoke checks after staging compose is up (GitHub-hosted CI).
set -euo pipefail

API_PORT="${API_HOST_PORT:-3001}"
WEB_PORT="${WEB_HOST_PORT:-3000}"
WORKER_PORT="${WORKER_HOST_PORT:-3002}"
API_BASE="http://127.0.0.1:${API_PORT}"
WEB_BASE="http://127.0.0.1:${WEB_PORT}"
WORKER_BASE="http://127.0.0.1:${WORKER_PORT}"

wait_http() {
  local url=$1
  local label=$2
  local attempts=${3:-60}
  local i=1
  while [ "$i" -le "$attempts" ]; do
    if curl -fsS "$url" >/dev/null; then
      echo "OK ${label}"
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done
  echo "FAIL ${label} — ${url} not ready after ${attempts} attempts"
  return 1
}

echo "=== SOSMesh container smoke ==="
wait_http "${API_BASE}/health" "api liveness"
wait_http "${API_BASE}/health/ready" "api readiness"
wait_http "${WEB_BASE}/health" "web liveness"
wait_http "${WORKER_BASE}/health/ready" "worker readiness"

echo "=== OpenAPI surface (unauthenticated health only) ==="
curl -fsS "${API_BASE}/health" | head -c 200
echo ""

echo "=== Container smoke PASSED ==="
