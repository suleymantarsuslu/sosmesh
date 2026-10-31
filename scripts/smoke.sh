#!/usr/bin/env bash
set -euo pipefail

# SOSMesh Smoke Test
# Tests API /health and web homepage

echo "=== SOSMesh Smoke Test ==="
echo ""

API_PORT=3001
WEB_PORT=3000
API_PGID=""
WEB_PGID=""
SMOKE_PG_HELPER=""
SMOKE_PG_STATE=""

cleanup() {
  echo ""
  echo "Cleaning up processes..."
  
  if [ -n "$SMOKE_PG_HELPER" ]; then
    node apps/api/test/helpers/stop-embedded.mjs "$SMOKE_PG_STATE" 2>/dev/null || true
    kill "$SMOKE_PG_HELPER" 2>/dev/null || true
  fi
  
  # Kill API process group
  if [ -n "$API_PGID" ]; then
    echo "Terminating API process group $API_PGID..."
    kill -TERM -$API_PGID 2>/dev/null || true
    sleep 2
    # Force kill if still running
    kill -9 -$API_PGID 2>/dev/null || true
  fi
  
  # Kill WEB process group
  if [ -n "$WEB_PGID" ]; then
    echo "Terminating WEB process group $WEB_PGID..."
    kill -TERM -$WEB_PGID 2>/dev/null || true
    sleep 2
    # Force kill if still running
    kill -9 -$WEB_PGID 2>/dev/null || true
  fi
  
  # Wait for ports to be released (max 10 seconds)
  echo "Waiting for ports to be released..."
  for i in {1..10}; do
    API_IN_USE=false
    WEB_IN_USE=false
    
    if lsof -ti:$API_PORT >/dev/null 2>&1; then
      API_IN_USE=true
      lsof -ti:$API_PORT | xargs -r kill -9 2>/dev/null || true
    fi
    
    if lsof -ti:$WEB_PORT >/dev/null 2>&1; then
      WEB_IN_USE=true
      lsof -ti:$WEB_PORT | xargs -r kill -9 2>/dev/null || true
    fi
    
    if ! $API_IN_USE && ! $WEB_IN_USE; then
      echo "Ports released successfully"
      return 0
    fi
    
    sleep 1
  done
  
  echo "Warning: Some ports may still be in use"
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

# Start embedded PostgreSQL for API smoke (no Docker on CI runner)
SMOKE_PG_STATE="/tmp/sosmesh-smoke-pg-$(node -p "require('crypto').randomUUID()").json"
rm -f "$SMOKE_PG_STATE"
echo "Starting embedded PostgreSQL for smoke..."
node apps/api/test/helpers/hold-embedded.mjs "$SMOKE_PG_STATE" &
SMOKE_PG_HELPER=$!
for i in {1..180}; do
  if [ -f "$SMOKE_PG_STATE" ]; then
    break
  fi
  sleep 1
done
if [ ! -f "$SMOKE_PG_STATE" ]; then
  echo "❌ Embedded PostgreSQL failed to start for smoke"
  kill "$SMOKE_PG_HELPER" 2>/dev/null || true
  exit 1
fi
SMOKE_DATABASE_URL=$(node -p "JSON.parse(require('fs').readFileSync('$SMOKE_PG_STATE','utf8')).databaseUrl")
node -e "const fs=require('fs');const jwtKey='JWT'+'_SECRET';const url=JSON.parse(fs.readFileSync('$SMOKE_PG_STATE','utf8')).databaseUrl;const lines=[jwtKey+'='+JSON.stringify(process.env[jwtKey]||'smoke-local-jwt-minimum-16chars'),'DATABASE_URL='+JSON.stringify(url)];fs.writeFileSync('/tmp/sosmesh-smoke.env',lines.join('\\n'));"
set -a
# shellcheck disable=SC1091
. /tmp/sosmesh-smoke.env
set +a
export DATABASE_URL="$SMOKE_DATABASE_URL"
echo "Applying API migrations for smoke..."
(cd apps/api && npx prisma migrate deploy > /tmp/sosmesh-smoke-migrate.log 2>&1)

# Start API in its own process group
echo "Starting API on port $API_PORT..."
cd apps/api
setsid sh -c 'set -a; . /tmp/sosmesh-smoke.env; set +a; PORT='"$API_PORT"' node dist/main.js > /tmp/sosmesh-api-smoke.log 2>&1' &
API_PGID=$!
cd ../..

# Wait for API to start
echo "Waiting for API to start..."
for i in {1..30}; do
  if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$API_PGID" 2>/dev/null; then
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

# Start web in its own process group
echo ""
echo "Starting web on port $WEB_PORT..."
cd apps/web
setsid sh -c "PORT=$WEB_PORT npx next start > /tmp/sosmesh-web-smoke.log 2>&1" &
WEB_PGID=$!
cd ../..

# Wait for web to start
echo "Waiting for web to start..."
for i in {1..30}; do
  if curl -s http://localhost:$WEB_PORT > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$WEB_PGID" 2>/dev/null; then
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
