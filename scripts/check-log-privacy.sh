#!/usr/bin/env bash
# SOSMesh Dev-Log Privacy Check
# Ensures sensitive data is not logged during development
# Usage: bash scripts/check-log-privacy.sh [log-file]

set -euo pipefail

LOG_FILE=${1:-/tmp/sosmesh-api-test.log}

if [ ! -f "$LOG_FILE" ]; then
  echo "❌ Log file not found: $LOG_FILE"
  exit 1
fi

echo "=== SOSMesh Dev-Log Privacy Check ==="
echo "Log file: $LOG_FILE"
echo ""

VIOLATIONS=0

# GPS coordinates (latitude/longitude with 4+ decimal places)
if grep -E '[-+]?[0-9]{1,3}\.[0-9]{4,},\s*[-+]?[0-9]{1,3}\.[0-9]{4,}' "$LOG_FILE" > /dev/null 2>&1; then
  echo "❌ GPS coordinates found in log"
  grep -n -E '[-+]?[0-9]{1,3}\.[0-9]{4,},\s*[-+]?[0-9]{1,3}\.[0-9]{4,}' "$LOG_FILE" | head -3
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Phone numbers (E.164 format)
if grep -E '\+[1-9][0-9]{7,14}' "$LOG_FILE" > /dev/null 2>&1; then
  echo "❌ Phone numbers found in log"
  grep -n -E '\+[1-9][0-9]{7,14}' "$LOG_FILE" | head -3
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Email addresses (but allow npm registry emails)
if grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' "$LOG_FILE" | \
   grep -v -E '@(example\.(com|org)|cursor\.com|npmjs\.(org|com)|izs\.me)' > /dev/null 2>&1; then
  echo "❌ Email addresses found in log"
  grep -n -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' "$LOG_FILE" | \
    grep -v -E '@(example\.(com|org)|cursor\.com|npmjs\.(org|com)|izs\.me)' | head -3
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# JWT tokens
if grep -E 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' "$LOG_FILE" > /dev/null 2>&1; then
  echo "❌ JWT tokens found in log"
  grep -n -E 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' "$LOG_FILE" | head -3
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Bearer tokens
if grep -E 'Bearer [A-Za-z0-9_\-\.+=]{20,}' "$LOG_FILE" > /dev/null 2>&1; then
  echo "❌ Bearer tokens found in log"
  grep -n -E 'Bearer [A-Za-z0-9_\-\.+=]{20,}' "$LOG_FILE" | head -3
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# API keys in log (MODEL_API_KEY, API_KEY values)
if grep -E '(MODEL_)?API_KEY["\s]*[:=]["\s]*[^<\s][^\s]{8,}' "$LOG_FILE" | \
   grep -v -E '(example|test|mock|<)' > /dev/null 2>&1; then
  echo "❌ API key values found in log"
  grep -n -E '(MODEL_)?API_KEY["\s]*[:=]["\s]*[^<\s][^\s]{8,}' "$LOG_FILE" | \
    grep -v -E '(example|test|mock|<)' | head -3
  VIOLATIONS=$((VIOLATIONS + 1))
fi

# Secret/password values (but allow placeholder mentions)
if grep -E '(SECRET|PASSWORD)["\s]*[:=]["\s]*[^<\s][^\s]{8,}' "$LOG_FILE" | \
   grep -v -E '(example|test|mock|<|placeholder|set-locally)' > /dev/null 2>&1; then
  echo "❌ Secret/password values found in log"
  grep -n -E '(SECRET|PASSWORD)["\s]*[:=]["\s]*[^<\s][^\s]{8,}' "$LOG_FILE" | \
    grep -v -E '(example|test|mock|<|placeholder|set-locally)' | head -3
  VIOLATIONS=$((VIOLATIONS + 1))
fi

echo ""
if [ $VIOLATIONS -eq 0 ]; then
  echo "✅ No privacy violations detected"
  echo "Log file is safe for development"
  exit 0
else
  echo "❌ $VIOLATIONS privacy violation(s) detected"
  echo "Sensitive data must not be logged"
  exit 1
fi
