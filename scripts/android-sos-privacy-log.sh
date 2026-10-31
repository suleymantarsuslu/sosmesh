#!/usr/bin/env bash
# Fail if SOS GPS coordinates or note bodies appear in Android log calls.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "Android SOS privacy log scan: ripgrep (rg) is required but not installed"
  exit 1
fi

PATTERN='(Log\.|Timber\.|android\.util\.Log)'
SEARCH_PATHS=(
  apps/android/feature-sos/src
  apps/android/feature-status/src
  apps/android/core/data/src/main
)

set +e
MATCHES="$(rg -n "$PATTERN" "${SEARCH_PATHS[@]}")"
RG_EXIT=$?
set -e

case "$RG_EXIT" in
  0)
    echo "Android SOS modules must not call Log/Timber (PII risk):"
    echo "$MATCHES"
    exit 1
    ;;
  1)
    echo "Android SOS privacy log scan: OK"
    exit 0
    ;;
  *)
    echo "Android SOS privacy log scan: rg failed with exit $RG_EXIT"
    exit 1
    ;;
esac
