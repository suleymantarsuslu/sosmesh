#!/usr/bin/env bash
# Fail if SOS GPS coordinates or note bodies appear in Android log calls.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN='(Log\.|Timber\.|android\.util\.Log)'
MATCHES=$(rg -n "$PATTERN" apps/android/feature-sos apps/android/feature-status apps/android/core/data/sos 2>/dev/null || true)
if [ -n "$MATCHES" ]; then
  echo "Android SOS modules must not call Log/Timber (PII risk):"
  echo "$MATCHES"
  exit 1
fi

echo "Android SOS privacy log scan: OK"
exit 0
