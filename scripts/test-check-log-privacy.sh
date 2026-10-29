#!/usr/bin/env bash
set -euo pipefail

# Test check-log-privacy.sh with positive and negative cases

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=== check-log-privacy.sh Test Suite ==="
echo ""

# Test 1: Clean log (positive)
echo "Test 1: Clean log file"
cat > "$TEMP_DIR/clean.log" << 'EOF'
2026-10-29T14:00:00Z INFO API started on port 3001
2026-10-29T14:00:01Z INFO Health check: OK
2026-10-29T14:00:02Z INFO Request received: POST /api/sos
2026-10-29T14:00:02Z INFO Request validated
EOF

if bash "$SCRIPT_DIR/check-log-privacy.sh" "$TEMP_DIR/clean.log" > /dev/null 2>&1; then
  echo "  ✅ Clean log passes"
else
  echo "  ❌ Clean log should pass"
  exit 1
fi

# Test 2: GPS coordinates (negative)
echo "Test 2: GPS coordinates detected"
cat > "$TEMP_DIR/gps.log" << 'EOF'
2026-10-29T14:00:00Z INFO Location: 41.0082, 28.9784
EOF

if bash "$SCRIPT_DIR/check-log-privacy.sh" "$TEMP_DIR/gps.log" > /dev/null 2>&1; then
  echo "  ❌ GPS coordinates should be detected"
  exit 1
else
  echo "  ✅ GPS coordinates detected"
fi

# Test 3: Phone number (negative)
echo "Test 3: Phone number detected"
cat > "$TEMP_DIR/phone.log" << 'EOF'
2026-10-29T14:00:00Z INFO User phone: +905551234567
EOF

if bash "$SCRIPT_DIR/check-log-privacy.sh" "$TEMP_DIR/phone.log" > /dev/null 2>&1; then
  echo "  ❌ Phone number should be detected"
  exit 1
else
  echo "  ✅ Phone number detected"
fi

# Test 4: Email (negative)
echo "Test 4: Email address detected"
cat > "$TEMP_DIR/email.log" << 'EOF'
2026-10-29T14:00:00Z INFO User: real.user@gmail.com
EOF

if bash "$SCRIPT_DIR/check-log-privacy.sh" "$TEMP_DIR/email.log" > /dev/null 2>&1; then
  echo "  ❌ Email should be detected"
  exit 1
else
  echo "  ✅ Email detected"
fi

# Test 5: JWT token (negative)
echo "Test 5: JWT token detected"
cat > "$TEMP_DIR/jwt.log" << 'EOF'
2026-10-29T14:00:00Z INFO Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
EOF

if bash "$SCRIPT_DIR/check-log-privacy.sh" "$TEMP_DIR/jwt.log" > /dev/null 2>&1; then
  echo "  ❌ JWT token should be detected"
  exit 1
else
  echo "  ✅ JWT token detected"
fi

# Test 6: API key value (negative)
echo "Test 6: API key value detected"
cat > "$TEMP_DIR/apikey.log" << 'EOF'
2026-10-29T14:00:00Z INFO MODEL_API_KEY=sk-1234567890abcdef
EOF

if bash "$SCRIPT_DIR/check-log-privacy.sh" "$TEMP_DIR/apikey.log" > /dev/null 2>&1; then
  echo "  ❌ API key should be detected"
  exit 1
else
  echo "  ✅ API key detected"
fi

# Test 7: Allowed emails (positive)
echo "Test 7: Allowed email domains"
cat > "$TEMP_DIR/allowed.log" << 'EOF'
2026-10-29T14:00:00Z INFO NPM registry: i@izs.me
2026-10-29T14:00:00Z INFO System: noreply@cursor.com
EOF

if bash "$SCRIPT_DIR/check-log-privacy.sh" "$TEMP_DIR/allowed.log" > /dev/null 2>&1; then
  echo "  ✅ Allowed emails pass"
else
  echo "  ❌ Allowed emails should pass"
  exit 1
fi

echo ""
echo "✅ All check-log-privacy.sh tests passed"
