#!/usr/bin/env bash
# Static scan: app BuildConfig must not embed secret-like field names (no Gradle required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRADLE="$ROOT/apps/android/app/build.gradle.kts"

if [ ! -f "$GRADLE" ]; then
  echo "FAIL: missing $GRADLE"
  exit 1
fi

FORBIDDEN='API_KEY|SECRET|PASSWORD|PRIVATE_KEY|JWT|TOKEN|MODEL_API_KEY'
if git grep -nE "buildConfigField\\(\"String\", \"($FORBIDDEN)\"" -- "$GRADLE" 2>/dev/null; then
  echo "FAIL: forbidden BuildConfig string fields in app gradle"
  exit 1
fi

for flavor in demo staging prod; do
  if ! grep -q "create(\"$flavor\")" "$GRADLE"; then
    echo "FAIL: missing product flavor $flavor"
    exit 1
  fi
done

if ! grep -q 'isMinifyEnabled = true' "$GRADLE"; then
  echo "FAIL: release minify not enabled"
  exit 1
fi

if grep -qE '\.(jks|keystore)' "$GRADLE"; then
  echo "FAIL: keystore file path must not be committed"
  exit 1
fi

if grep -q 'signingConfigs.getByName("debug")' "$GRADLE" && ! grep -q 'sosmesh.allowDebugSignedRelease' "$GRADLE"; then
  echo "FAIL: release must not silently sign with debug key (use env keystore, unsigned, or -Psosmesh.allowDebugSignedRelease=true)"
  exit 1
fi

echo "android-release-buildconfig-scan: OK"
exit 0
