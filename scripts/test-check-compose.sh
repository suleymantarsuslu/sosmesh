#!/usr/bin/env bash
set -euo pipefail

# Test check-compose.js with positive and negative cases

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=== check-compose.js Test Suite ==="
echo ""

# Test 1: Valid compose.yaml (positive)
echo "Test 1: Valid compose.yaml"
cp "$REPO_ROOT/compose.yaml" "$TEMP_DIR/compose-valid.yaml"
if node "$SCRIPT_DIR/check-compose.js" "$TEMP_DIR/compose-valid.yaml" > /dev/null 2>&1; then
  echo "  ✅ Valid compose passes"
else
  echo "  ❌ Valid compose should pass"
  exit 1
fi

# Test 2: Missing healthcheck (negative)
echo "Test 2: Missing healthcheck in postgres"
cat > "$TEMP_DIR/compose-no-healthcheck.yaml" << 'EOF'
services:
  postgres:
    image: postgres:16-alpine
  api:
    build:
      context: .
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3001/health"]
      interval: 10s
  web:
    build:
      context: .
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000"]
      interval: 10s
EOF

if node "$SCRIPT_DIR/check-compose.js" "$TEMP_DIR/compose-no-healthcheck.yaml" > /dev/null 2>&1; then
  echo "  ❌ Missing healthcheck should fail"
  exit 1
else
  echo "  ✅ Missing healthcheck detected"
fi

# Test 3: Missing service (negative)
echo "Test 3: Missing required service (web)"
cat > "$TEMP_DIR/compose-no-web.yaml" << 'EOF'
services:
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 5s
  api:
    build:
      context: .
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3001/health"]
      interval: 10s
EOF

if node "$SCRIPT_DIR/check-compose.js" "$TEMP_DIR/compose-no-web.yaml" > /dev/null 2>&1; then
  echo "  ❌ Missing service should fail"
  exit 1
else
  echo "  ✅ Missing service detected"
fi

# Test 4: Missing image and build (negative)
echo "Test 4: Service without image or build"
cat > "$TEMP_DIR/compose-no-image.yaml" << 'EOF'
services:
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 5s
  api:
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3001/health"]
      interval: 10s
  web:
    build:
      context: .
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000"]
      interval: 10s
EOF

if node "$SCRIPT_DIR/check-compose.js" "$TEMP_DIR/compose-no-image.yaml" > /dev/null 2>&1; then
  echo "  ❌ Missing image/build should fail"
  exit 1
else
  echo "  ✅ Missing image/build detected"
fi

echo ""
echo "✅ All check-compose.js tests passed"
