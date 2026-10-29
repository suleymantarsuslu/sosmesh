#!/bin/bash
set -euo pipefail

echo "=== Cross-Language Canonical JSON Comparison ==="
echo

TS_DIR="packages/contracts/build/canonical-json"
KOTLIN_DIR="packages/contracts-kotlin/build/canonical-json"

if [ ! -d "$TS_DIR" ]; then
  echo "❌ TypeScript canonical outputs not found: $TS_DIR"
  exit 1
fi

if [ ! -d "$KOTLIN_DIR" ]; then
  echo "❌ Kotlin canonical outputs not found: $KOTLIN_DIR"
  exit 1
fi

FAILED=0

for fixture in valid-sos unicode-sos; do
  echo "Comparing $fixture..."
  
  TS_FILE="$TS_DIR/${fixture}-typescript.json"
  KOTLIN_FILE="$KOTLIN_DIR/${fixture}-kotlin.json"
  
  if [ ! -f "$TS_FILE" ]; then
    echo "  ❌ TypeScript output not found: $TS_FILE"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  if [ ! -f "$KOTLIN_FILE" ]; then
    echo "  ❌ Kotlin output not found: $KOTLIN_FILE"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  # Parse both and compare semantically using jq
  # Note: JSON numbers like 15 and 15.0 are semantically equal
  TS_NORMALIZED=$(cat "$TS_FILE" | jq -c -S '.')
  KOTLIN_NORMALIZED=$(cat "$KOTLIN_FILE" | jq -c -S '.')
  
  # Use jq to test equality (handles 15 == 15.0)
  if jq -n --argjson ts "$TS_NORMALIZED" --argjson kt "$KOTLIN_NORMALIZED" '$ts == $kt' | grep -q true; then
    echo "  ✅ MATCH: TypeScript and Kotlin produce equivalent canonical JSON"
  else
    echo "  ❌ MISMATCH: TypeScript and Kotlin outputs differ"
    echo "  TypeScript: $TS_NORMALIZED"
    echo "  Kotlin:     $KOTLIN_NORMALIZED"
    echo "  Diff:"
    diff -u <(echo "$TS_NORMALIZED" | jq .) <(echo "$KOTLIN_NORMALIZED" | jq .) || true
    FAILED=$((FAILED + 1))
  fi
  echo
done

if [ $FAILED -eq 0 ]; then
  echo "✅ All cross-language comparisons PASSED"
  exit 0
else
  echo "❌ $FAILED cross-language comparison(s) FAILED"
  exit 1
fi
