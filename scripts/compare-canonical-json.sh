#!/bin/bash
set -euo pipefail

echo "=== Cross-Language Canonical JSON Comparison (3 Languages) ==="
echo

TS_DIR="packages/contracts/build/canonical-json"
KOTLIN_DIR="packages/contracts-kotlin/build/canonical-json"
SWIFT_DIR="packages/contracts-swift/build/canonical-json"

# Check all directories exist
MISSING=0
if [ ! -d "$TS_DIR" ]; then
  echo "❌ TypeScript canonical outputs not found: $TS_DIR"
  MISSING=1
fi

if [ ! -d "$KOTLIN_DIR" ]; then
  echo "❌ Kotlin canonical outputs not found: $KOTLIN_DIR"
  MISSING=1
fi

if [ ! -d "$SWIFT_DIR" ]; then
  echo "❌ Swift canonical outputs not found: $SWIFT_DIR"
  MISSING=1
fi

if [ $MISSING -eq 1 ]; then
  echo "❌ One or more language outputs missing"
  exit 1
fi

FAILED=0

for fixture in valid-sos unicode-sos; do
  echo "Comparing $fixture across TypeScript, Kotlin, and Swift..."
  
  TS_FILE="$TS_DIR/${fixture}-typescript.json"
  KOTLIN_FILE="$KOTLIN_DIR/${fixture}-kotlin.json"
  SWIFT_FILE="$SWIFT_DIR/${fixture}-swift.json"
  
  # Check all files exist
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
  
  if [ ! -f "$SWIFT_FILE" ]; then
    echo "  ❌ Swift output not found: $SWIFT_FILE"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  # Parse and normalize all three
  TS_NORMALIZED=$(cat "$TS_FILE" | jq -c -S '.')
  KOTLIN_NORMALIZED=$(cat "$KOTLIN_FILE" | jq -c -S '.')
  SWIFT_NORMALIZED=$(cat "$SWIFT_FILE" | jq -c -S '.')
  
  # Compare TS vs Kotlin
  TS_KT_MATCH=0
  if jq -n --argjson ts "$TS_NORMALIZED" --argjson kt "$KOTLIN_NORMALIZED" '$ts == $kt' | grep -q true; then
    TS_KT_MATCH=1
  fi
  
  # Compare TS vs Swift
  TS_SW_MATCH=0
  if jq -n --argjson ts "$TS_NORMALIZED" --argjson sw "$SWIFT_NORMALIZED" '$ts == $sw' | grep -q true; then
    TS_SW_MATCH=1
  fi
  
  # Compare Kotlin vs Swift
  KT_SW_MATCH=0
  if jq -n --argjson kt "$KOTLIN_NORMALIZED" --argjson sw "$SWIFT_NORMALIZED" '$kt == $sw' | grep -q true; then
    KT_SW_MATCH=1
  fi
  
  if [ $TS_KT_MATCH -eq 1 ] && [ $TS_SW_MATCH -eq 1 ] && [ $KT_SW_MATCH -eq 1 ]; then
    echo "  ✅ MATCH: All three languages produce equivalent canonical JSON"
  else
    echo "  ❌ MISMATCH: Language outputs differ"
    echo "  TypeScript:  $TS_NORMALIZED"
    echo "  Kotlin:      $KOTLIN_NORMALIZED"
    echo "  Swift:       $SWIFT_NORMALIZED"
    echo
    if [ $TS_KT_MATCH -eq 0 ]; then
      echo "  Diff (TS vs Kotlin):"
      diff -u <(echo "$TS_NORMALIZED" | jq .) <(echo "$KOTLIN_NORMALIZED" | jq .) || true
    fi
    if [ $TS_SW_MATCH -eq 0 ]; then
      echo "  Diff (TS vs Swift):"
      diff -u <(echo "$TS_NORMALIZED" | jq .) <(echo "$SWIFT_NORMALIZED" | jq .) || true
    fi
    if [ $KT_SW_MATCH -eq 0 ]; then
      echo "  Diff (Kotlin vs Swift):"
      diff -u <(echo "$KOTLIN_NORMALIZED" | jq .) <(echo "$SWIFT_NORMALIZED" | jq .) || true
    fi
    FAILED=$((FAILED + 1))
  fi
  echo
done

if [ $FAILED -eq 0 ]; then
  echo "✅ All cross-language comparisons PASSED (TypeScript == Kotlin == Swift)"
  exit 0
else
  echo "❌ $FAILED cross-language comparison(s) FAILED"
  exit 1
fi
