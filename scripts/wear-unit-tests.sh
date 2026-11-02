#!/usr/bin/env bash
# ADIM 53 — Wear modülü JVM birim testleri (manifest, UI Robolectric, telefonsuz kopya).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="${ROOT}/apps/android"
REPORT="${ROOT}/reports/wear-unit-tests.log"

mkdir -p "${ROOT}/reports"

{
  echo "wear-unit-tests: started $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ -z "${ANDROID_HOME:-}" && ! -f "${ANDROID_DIR}/local.properties" ]]; then
    echo "ANDROID_HOME yok — Gradle wear testleri bu ortamda koşturulmadı (NOT_TESTED; CI android-gradle job doğrular)"
    exit 0
  fi
  cd "${ANDROID_DIR}"
  ./gradlew :wear:testDebugUnitTest :core:wear-companion:testDebugUnitTest --no-daemon
  echo "wear-unit-tests: OK"
} 2>&1 | tee "${REPORT}"
