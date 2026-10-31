#!/usr/bin/env bash
# Ensure dev-test SOS crypto helpers never ship in release/main source sets (no JDK/Gradle).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DATA_MODULE="apps/android/core/data"
MAIN_TREE="$DATA_MODULE/src/main"
RELEASE_TREE="$DATA_MODULE/src/release"
DEBUG_DEV="$DATA_MODULE/src/debug/kotlin/com/sosmesh/android/core/data/sos/DevTestCryptoConfig.kt"

if [ ! -f "$DEBUG_DEV" ]; then
  echo "FAIL: expected debug-only DevTestCryptoConfig at $DEBUG_DEV"
  exit 1
fi

fail_if_present() {
  local label=$1
  shift
  set +e
  local matches
  matches="$(git grep -n -E 'DevTestCryptoConfig' -- "$@" 2>&1)"
  local exit_code=$?
  set -e
  if [ "$exit_code" -eq 0 ]; then
    echo "FAIL: DevTestCryptoConfig must not appear in $label:"
    echo "$matches"
    exit 1
  fi
  if [ "$exit_code" -ne 1 ]; then
    echo "FAIL: git grep error ($exit_code) while scanning $label"
    echo "$matches"
    exit 1
  fi
}

fail_if_present "main source set" "$MAIN_TREE"
fail_if_present "release source set" "$RELEASE_TREE"

# Release DI must fail loudly without referencing dev-test config.
set +e
release_di_match="$(git grep -n 'DevTestCryptoConfig' -- "$RELEASE_TREE/kotlin/com/sosmesh/android/core/data/di" 2>&1)"
release_di_exit=$?
set -e
if [ "$release_di_exit" -eq 0 ]; then
  echo "FAIL: release DI references DevTestCryptoConfig:"
  echo "$release_di_match"
  exit 1
fi
if [ "$release_di_exit" -ne 1 ]; then
  echo "FAIL: git grep error ($release_di_exit) on release DI"
  echo "$release_di_match"
  exit 1
fi

echo "android-release-no-dev-crypto: OK (DevTestCryptoConfig confined to debug; static source-set scan)"
exit 0
