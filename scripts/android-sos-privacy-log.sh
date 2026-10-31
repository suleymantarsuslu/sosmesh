#!/usr/bin/env bash
# Fail if SOS modules call Log/Timber (PII risk). Uses git grep (always available in CI).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN='(Log\.|Timber\.|android\.util\.Log)'
SEARCH_PATHS=(
  apps/android/feature-sos/src
  apps/android/feature-status/src
  apps/android/core/data/src/main
)

set +e
MATCHES="$(git grep -n -E "$PATTERN" -- "${SEARCH_PATHS[@]}")"
GIT_EXIT=$?
set -e

case "$GIT_EXIT" in
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
    echo "Android SOS privacy log scan: git grep failed with exit $GIT_EXIT"
    echo "$MATCHES"
    exit 1
    ;;
esac
