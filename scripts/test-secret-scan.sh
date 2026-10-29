#!/bin/bash
# Test script for secret-scan.sh
# Her pattern için sahte örnek oluşturur ve taramamın bulduğunu doğrular

set -e

echo "=== Secret Scan Negatif Test ==="
echo ""

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

TEST_PASSED=0
TEST_FAILED=0

# Test fonksiyonu
test_pattern() {
  local DESC="$1"
  local CONTENT="$2"
  local SHOULD_DETECT="$3"  # 1: tespit etmeli, 0: tespit etmemeli
  
  local TEST_FILE="$TEMP_DIR/test-$(date +%s%N).txt"
  echo "$CONTENT" > "$TEST_FILE"
  
  if bash scripts/secret-scan.sh "$TEST_FILE" > /dev/null 2>&1; then
    DETECTED=0
  else
    DETECTED=1
  fi
  
  if [ "$DETECTED" -eq "$SHOULD_DETECT" ]; then
    echo "✅ $DESC"
    TEST_PASSED=$((TEST_PASSED + 1))
  else
    echo "❌ $DESC (beklenen: detect=$SHOULD_DETECT, gerçek: detect=$DETECTED)"
    TEST_FAILED=$((TEST_FAILED + 1))
  fi
}

# OpenAI key (sahte, runtime üretildi)
FAKE_OPENAI="sk-$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 48)"
test_pattern "OpenAI key tespit edilmeli" "API_KEY=$FAKE_OPENAI" 1

# GitHub token (sahte)
FAKE_GITHUB="ghp_$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 36)"
test_pattern "GitHub token tespit edilmeli" "TOKEN=$FAKE_GITHUB" 1

# AWS key (sahte)
FAKE_AWS="AKIA$(LC_ALL=C tr -dc 'A-Z0-9' < /dev/urandom | head -c 16)"
test_pattern "AWS key tespit edilmeli" "AWS_ACCESS_KEY_ID=$FAKE_AWS" 1

# Private key
FAKE_PRIVATE="-----BEGIN RSA PRIVATE KEY-----
MIIBogIBAAJBAKj34GkxFhD90vcNLYLInFEX6Pmr3ZOxa4k+U8M7K3Fk4GXXHkVL
-----END RSA PRIVATE KEY-----"
test_pattern "Private key tespit edilmeli" "$FAKE_PRIVATE" 1

# E-posta (gerçek görünümlü, allowlist dışı)
test_pattern "E-posta (allowlist dışı) tespit edilmeli" "contact@realdomain.com" 1

# E-posta (allowlist içi)
test_pattern "E-posta (allowlist içi) tespit edilmemeli" "user@example.com" 0
test_pattern "E-posta (cursor allowlist) tespit edilmemeli" "cursoragent@cursor.com" 0

# GPS koordinat (gerçek görünümlü)
test_pattern "GPS koordinat tespit edilmeli" "39.9334,32.8597" 1

# JWT (sahte)
FAKE_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
test_pattern "JWT tespit edilmeli" "Authorization: Bearer $FAKE_JWT" 1

# Bearer token (sahte)
FAKE_BEARER="Bearer $(head -c 15 /dev/urandom | base64 | tr -d '/+=')"
test_pattern "Bearer token tespit edilmeli" "$FAKE_BEARER" 1

# KEY=değer (gerçek)
test_pattern "API_KEY=gerçek_değer tespit edilmeli" "API_KEY=abc123secret" 1

# KEY=<placeholder> (atlanmalı)
test_pattern "API_KEY=<placeholder> tespit edilmemeli" "API_KEY=<your-key-here>" 0
test_pattern "SECRET=boş tespit edilmemeli" "SECRET=" 0

# Telefon (E.164)
test_pattern "Telefon +90 tespit edilmeli" "+905551234567" 1
test_pattern "Telefon +1 tespit edilmeli" "+12025551234" 1

# 40-hex (git commit değil)
FAKE_HEX="$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 40)"
test_pattern "40-hex (commit değil) tespit edilmeli" "hash=$FAKE_HEX" 1

# Temiz dosya
test_pattern "Temiz dosya tespit edilmemeli" "Bu dosyada secret yok, sadece normal metin." 0

echo ""
echo "=== Test Özeti ==="
echo "Başarılı: $TEST_PASSED"
echo "Başarısız: $TEST_FAILED"

if [ $TEST_FAILED -gt 0 ]; then
  echo "❌ Bazı testler başarısız"
  exit 1
else
  echo "✅ Tüm testler başarılı"
  exit 0
fi
