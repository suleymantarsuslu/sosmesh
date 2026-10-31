#!/usr/bin/env bash
# Ensure dev-test SOS crypto helpers are not compiled into release classpaths.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/android"

./gradlew :core:data:compileReleaseKotlin -q

RELEASE_CLASSES="$ROOT/apps/android/core/data/build/tmp/kotlin-classes/release"
if [ ! -d "$RELEASE_CLASSES" ]; then
  echo "Release class output missing: $RELEASE_CLASSES"
  exit 1
fi

if find "$RELEASE_CLASSES" -name 'DevTestCryptoConfig*.class' | grep -q .; then
  echo "FAIL: DevTestCryptoConfig present in release kotlin-classes"
  find "$RELEASE_CLASSES" -name 'DevTestCryptoConfig*.class'
  exit 1
fi

echo "android-release-no-dev-crypto: OK (DevTestCryptoConfig absent from release)"
exit 0
