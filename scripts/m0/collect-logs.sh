#!/usr/bin/env bash
# Collect Android logcat lines for a correlation ID (message / trace id).
# Masks GPS coordinates, SOS-like free text, and common PII patterns before writing output.
set -euo pipefail

usage() {
  echo "Usage: $0 <correlation-id> [output-file]" >&2
  echo "Requires: adb, exactly one authorized device (adb devices)." >&2
}

if [[ "${1:-}" == "" ]]; then
  usage
  exit 2
fi

CORRELATION_ID="$1"
OUT_FILE="${2:-evidence/m0/logcat-${CORRELATION_ID}.redacted.log}"

if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb not found in PATH. Install Android platform-tools and retry on a machine with USB debugging." >&2
  exit 3
fi

mapfile -t DEVICES < <(adb devices | awk 'NR>1 && $2=="device" {print $1}')
DEVICE_COUNT="${#DEVICES[@]}"
if [[ "$DEVICE_COUNT" -eq 0 ]]; then
  echo "ERROR: No adb-authorized Android device detected. Connect a device, enable USB debugging, accept RSA prompt." >&2
  exit 4
fi
if [[ "$DEVICE_COUNT" -gt 1 ]]; then
  echo "ERROR: Multiple adb devices (${DEVICE_COUNT}). Set ANDROID_SERIAL or disconnect extras." >&2
  exit 5
fi

mkdir -p "$(dirname "$OUT_FILE")"

TMP_RAW="$(mktemp)"
trap 'rm -f "$TMP_RAW"' EXIT

if ! adb logcat -d -v threadtime | grep -F "$CORRELATION_ID" >"$TMP_RAW"; then
  echo "ERROR: logcat grep found no lines for correlation id ${CORRELATION_ID}." >&2
  exit 6
fi

if [[ ! -s "$TMP_RAW" ]]; then
  echo "ERROR: logcat output empty for correlation id ${CORRELATION_ID}." >&2
  exit 6
fi

# Redact before persisting: lat/lon pairs, emails, phone-ish sequences, long free-text blobs.
sed -E \
  -e 's/[-+]?[0-9]{1,3}\.[0-9]{4,}/[REDACTED_COORD]/g' \
  -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[REDACTED_EMAIL]/g' \
  -e 's/\b[0-9]{10,14}\b/[REDACTED_PHONE]/g' \
  -e 's/(SOS|sos|message|plaintext|note)([^[:print:]]{0,20})[^[:print:]]{8,}/\1\2[REDACTED_TEXT]/g' \
  "$TMP_RAW" >"$OUT_FILE"

echo "Wrote redacted logcat ($(wc -l <"$OUT_FILE") lines) to $OUT_FILE"
