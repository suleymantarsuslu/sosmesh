#!/usr/bin/env bash
# ADIM 53 — Wear OS release AAB packaging (imza yalnızca env/property adlarıyla).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="${ROOT}/apps/android"
REPORT="${ROOT}/reports/wear-release-bundle.log"

mkdir -p "${ROOT}/reports"

{
  echo "wear-release-bundle: started $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ -z "${ANDROID_HOME:-}" && ! -f "${ANDROID_DIR}/local.properties" ]]; then
    echo "ANDROID_HOME yok — bundleRelease bu ortamda koşturulmadı (NOT_TESTED; CI android-gradle job doğrular)"
    exit 0
  fi

  cd "${ANDROID_DIR}"

  if [[ -n "${SOSMESH_WEAR_RELEASE_STORE_FILE:-}" ]]; then
    echo "SOSMESH_WEAR_RELEASE_STORE_FILE tanımlı — imzalı bundleRelease hedeflenir (anahtar repoda değil)"
  else
    echo "SOSMESH_WEAR_RELEASE_STORE_FILE tanımsız — imzasız release AAB (BLOCKED_APPROVAL: Play upload anahtarı kullanıcı onayı)"
  fi

  ./gradlew :wear:bundleRelease :wear:testDebugUnitTest --no-daemon

  AAB_DIR="${ANDROID_DIR}/wear/build/outputs/bundle/release"
  if compgen -G "${AAB_DIR}/*.aab" > /dev/null; then
    echo "AAB üretildi:"
    ls -la "${AAB_DIR}"/*.aab
    shasum -a 256 "${AAB_DIR}"/*.aab
  else
    echo "AAB bulunamadı"
    exit 1
  fi
  echo "wear-release-bundle: OK"
} 2>&1 | tee "${REPORT}"
