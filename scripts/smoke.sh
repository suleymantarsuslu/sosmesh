#!/usr/bin/env bash
set -euo pipefail

# SOSMesh Smoke Test
# Tests API /health and web homepage

echo "=== SOSMesh Smoke Test ==="
echo ""

API_PORT=3001
WEB_PORT=3000
API_PID=""
WEB_PID=""

cleanup() {
  echo ""
  echo "Cleaning up processes..."
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
    wait "$WEB_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

# Check if API build exists
if [ ! -d "apps/api/dist" ]; then
  echo "❌ API build not found. Run 'pnpm -r build' first."
  exit 1
fi

# Check if web build exists
if [ ! -d "apps/web/.next" ]; then
  echo "❌ Web build not found. Run 'pnpm -r build' first."
  exit 1
fi

# Start API
echo "Starting API on port $API_PORT..."
cd apps/api
PORT=$API_PORT node dist/main.js > /tmp/sosmesh-api-smoke.log 2>&1 &
API_PID=$!
cd ../..

# Wait for API to start
echo "Waiting for API to start..."
for i in {1..30}; do
  if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "❌ API process died"
    cat /tmp/sosmesh-api-smoke.log
    exit 1
  fi
  sleep 1
done

# Test API /health
echo ""
echo "Testing API /health..."
RESPONSE=$(curl -s http://localhost:$API_PORT/health)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$API_PORT/health)

if [ "$STATUS" != "200" ]; then
  echo "❌ API /health returned $STATUS (expected 200)"
  exit 1
fi

echo "✅ API /health: $STATUS"
echo "   Response: $RESPONSE"

if ! echo "$RESPONSE" | grep -q '"status"'; then
  echo "❌ API /health response missing 'status' field"
  exit 1
fi

if ! echo "$RESPONSE" | grep -q '"ok"'; then
  echo "❌ API /health status not 'ok'"
  exit 1
fi

echo "✅ API /health status is 'ok'"

# Start web
echo ""
echo "Starting web on port $WEB_PORT..."
cd apps/web
PORT=$WEB_PORT npx next start > /tmp/sosmesh-web-smoke.log 2>&1 &
WEB_PID=$!
cd ../..

# Wait for web to start
echo "Waiting for web to start..."
for i in {1..30}; do
  if curl -s http://localhost:$WEB_PORT > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "❌ Web process died"
    cat /tmp/sosmesh-web-smoke.log
    exit 1
  fi
  sleep 1
done

# Test web homepage
echo ""
echo "Testing web homepage..."
WEB_RESPONSE=$(curl -s http://localhost:$WEB_PORT)
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$WEB_PORT)

if [ "$WEB_STATUS" != "200" ]; then
  echo "❌ Web homepage returned $WEB_STATUS (expected 200)"
  exit 1
fi

echo "✅ Web homepage: $WEB_STATUS"

if ! echo "$WEB_RESPONSE" | grep -q "SOSMesh"; then
  echo "❌ Web homepage does not contain 'SOSMesh'"
  exit 1
fi

echo "✅ Web homepage contains 'SOSMesh'"

echo ""
echo "=== Smoke Test PASSED ==="
