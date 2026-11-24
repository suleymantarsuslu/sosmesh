#!/bin/bash
# Test script for secret-scan.sh
# Her pattern için sahte örnek oluşturur ve taramamın bulduğunu doğrular

set -e
SCANNER="$(pwd)/scripts/secret-scan.sh"

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
  
  if bash "$SCANNER" "$TEST_FILE" > /dev/null 2>&1; then
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

# Bearer token (sabit, deterministik, 25 karakter - kesin eşleşir)
FAKE_BEARER_TOKEN="FAKE_TEST_BEARER_TOKEN_25CHAR"
test_pattern "Bearer token tespit edilmeli" "Bearer $FAKE_BEARER_TOKEN" 1

# KEY=değer (gerçek)
test_pattern "API_KEY=gerçek_değer tespit edilmeli" "API_KEY=abc123secret" 1

# KEY=<placeholder> (atlanmalı)
test_pattern "API_KEY=<placeholder> tespit edilmemeli" "API_KEY=<your-key-here>" 0
test_pattern "SECRET=boş tespit edilmemeli" "SECRET=" 0

# Telefon (E.164)
test_pattern "Telefon +90 tespit edilmeli" "+905551234567" 1
test_pattern "Telefon +1 tespit edilmeli" "+12025551234" 1

# 40-hex bağlamında - gerçek sahte token yakalanmalı
FAKE_HEX_TOKEN="$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 40)"
test_pattern "40-hex secret bağlamında tespit edilmeli" "secret=$FAKE_HEX_TOKEN" 1
test_pattern "40-hex token bağlamında tespit edilmeli" "token:$FAKE_HEX_TOKEN" 1

# Git commit SHA bağlamında - artık yakalanmamalı
FAKE_COMMIT_SHA="$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 40)"
test_pattern "commit SHA tespit edilmemeli" "commit: $FAKE_COMMIT_SHA" 0
test_pattern "SHA dokumentasyonda tespit edilmemeli" "SHA: $FAKE_COMMIT_SHA" 0

# Temiz dosya
test_pattern "Temiz dosya tespit edilmemeli" "Bu dosyada secret yok, sadece normal metin." 0

# CI ephemeral env — dar muafiyet (referans / openssl rand)
test_pattern "JWT_SECRET=\${JWT_SECRET} referansı atlanmalı" 'echo "JWT_SECRET=${JWT_SECRET}"' 0
test_pattern "openssl rand ataması atlanmalı" 'JWT_SECRET=$(openssl rand -base64 32)' 0

# Geniş muafiyet olmamalı
test_pattern "varsayılan parola (\${X:-...}) yakalanmalı" 'PASSWORD=${X:-hunter2longsecret}' 1
test_pattern "sabit PASSWORD değeri yakalanmalı" 'PASSWORD=Sup3rS3cretValue' 1
test_pattern "API_KEY=\$(echo sabit) yakalanmalı" 'API_KEY=$(echo sabitSecret)' 1

echo ""

# Fixture tests for Greptile P1 cases

# 1) Special / quoted filename
{
  REPO="$TEMP_DIR/fixture_quoted"
  mkdir -p "$REPO"
  git -C "$REPO" init -q
  git -C "$REPO" config user.email "test@example.com"
  git -C "$REPO" config user.name "Test"
  # Dummy initial commit
  touch "$REPO/dummy.txt"
  git -C "$REPO" add "$REPO/dummy.txt"
  git -C "$REPO" commit -m "initial commit" -q
  FILE="$REPO/quoted file.txt"
  echo "API_KEY=quotedsecret" > "$FILE"
  git -C "$REPO" add "$FILE"
  git -C "$REPO" commit -m "add quoted file" -q
  if (cd "$REPO" && bash "$SCANNER" > /dev/null 2>&1); then
    DETECTED=0
  else
    DETECTED=1
  fi
  if [ "$DETECTED" -eq 1 ]; then
    echo "✅ Special / quoted filename"
    TEST_PASSED=$((TEST_PASSED + 1))
  else
    echo "❌ Special / quoted filename (expected detection)"
    TEST_FAILED=$((TEST_FAILED + 1))
  fi
}

# 2) Type change (T)
{
  REPO="$TEMP_DIR/fixture_type_change"
  mkdir -p "$REPO"
  git -C "$REPO" init -q
  git -C "$REPO" config user.email "test@example.com"
  git -C "$REPO" config user.name "Test"
  SYMLINK="$REPO/linkfile"
  ln -s /dev/null "$SYMLINK"
  git -C "$REPO" add "$SYMLINK"
  git -C "$REPO" commit -m "add symlink" -q
  # Replace symlink with regular file containing secret
  rm "$SYMLINK"
  echo "API_KEY=typechangesecret" > "$SYMLINK"
  git -C "$REPO" add -A
  git -C "$REPO" commit -m "replace with file containing secret" -q
  if (cd "$REPO" && bash "$SCANNER" > /dev/null 2>&1); then
    DETECTED=0
  else
    DETECTED=1
  fi
  if [ "$DETECTED" -eq 1 ]; then
    echo "✅ Type change (T) detection"
    TEST_PASSED=$((TEST_PASSED + 1))
  else
    echo "❌ Type change (T) detection (expected detection)"
    TEST_FAILED=$((TEST_FAILED + 1))
  fi
}

# 3) Merge-commit fallback
{
  REPO="$TEMP_DIR/fixture_merge"
  mkdir -p "$REPO"
  git -C "$REPO" init -b main -q
  git -C "$REPO" config user.email "test@example.com"
  git -C "$REPO" config user.name "Test"
  # Base commit without secret
  echo "no secret" > "$REPO/base.txt"
  git -C "$REPO" add "$REPO/base.txt"
  git -C "$REPO" commit -m "base commit" -q
  # Feature branch with secret
  git -C "$REPO" checkout -b feature -q
  echo "API_KEY=featuresecret" > "$REPO/secret.txt"
  git -C "$REPO" add "$REPO/secret.txt"
  git -C "$REPO" commit -m "add secret on feature" -q
  # Merge feature into main
  git -C "$REPO" checkout main -q
  unset SECRET_SCAN_BASE_SHA SECRET_SCAN_HEAD_SHA GITHUB_EVENT_NAME
  git -C "$REPO" merge feature --no-ff -m "merge feature" -q
  if (cd "$REPO" && bash "$SCANNER" > /dev/null 2>&1); then
    DETECTED=0
  else
    DETECTED=1
  fi
  if [ "$DETECTED" -eq 1 ]; then
    echo "✅ Merge-commit fallback detection"
    TEST_PASSED=$((TEST_PASSED + 1))
  else
    echo "❌ Merge-commit fallback detection (expected detection)"
    TEST_FAILED=$((TEST_FAILED + 1))
  fi
}

# 4) Fail-closed when no comparison possible
{
  DIR="$TEMP_DIR/fail_closed"
  mkdir -p "$DIR"
  git -C "$DIR" init -q
  git -C "$DIR" config user.email "test@example.com"
  git -C "$DIR" config user.name "Test"
  if (cd "$DIR" && bash "$SCANNER" > /dev/null 2>&1); then
    echo "❌ Fail-closed test (expected non-zero exit)"
    TEST_FAILED=$((TEST_FAILED + 1))
  else
    echo "✅ Fail-closed test"
    TEST_PASSED=$((TEST_PASSED + 1))
  fi
}

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
