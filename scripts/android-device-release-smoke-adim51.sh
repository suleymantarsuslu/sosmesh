#!/usr/bin/env bash
# ADIM 51 — gerçek cihaz smoke toplama (MacBook + 2 Android). Bu ortamda adb yoksa NOT_TESTED döner.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE_DIR="${1:-$ROOT/docs/release/evidence/runs/adim51-smoke}"
mkdir -p "$EVIDENCE_DIR"

if ! command -v adb >/dev/null 2>&1; then
  echo "NOT_TESTED: adb bulunamadı — smoke cihaz kanıtı kullanıcı Mac/cihaz aşamasında toplanacak."
  echo "status=NOT_TESTED" > "$EVIDENCE_DIR/SUMMARY.txt"
  echo "reason=adb_missing" >> "$EVIDENCE_DIR/SUMMARY.txt"
  exit 2
fi

DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device" { c++ } END { print c+0 }')"
if [ "$DEVICE_COUNT" -lt 2 ]; then
  echo "NOT_TESTED: en az 2 adb cihaz gerekli (bulunan: $DEVICE_COUNT)."
  echo "status=NOT_TESTED" > "$EVIDENCE_DIR/SUMMARY.txt"
  echo "devices=$DEVICE_COUNT" >> "$EVIDENCE_DIR/SUMMARY.txt"
  exit 2
fi

APK="${APK_PATH:-$ROOT/apps/android/app/build/outputs/apk/prod/release/app-prod-release.apk}"
if [ ! -f "$APK" ]; then
  echo "FAIL: APK yok — önce: cd apps/android && ./gradlew assembleProdRelease"
  exit 1
fi

sha256sum "$APK" | tee "$EVIDENCE_DIR/apk-sha256.txt"
adb devices -l | tee "$EVIDENCE_DIR/adb-devices.txt"

echo "Manuel adımlar: docs/release/android.md § Gerçek cihaz smoke planı"
echo "status=COLLECTING" > "$EVIDENCE_DIR/SUMMARY.txt"
echo "apk=$APK" >> "$EVIDENCE_DIR/SUMMARY.txt"
exit 0
