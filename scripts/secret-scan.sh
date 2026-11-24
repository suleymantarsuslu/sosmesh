#!/bin/bash
# SOSMesh Secret Scan — Gelişmiş gizlilik taraması
# git ls-files üzerinde çalışır, gerçek commit SHA'ları ayıklar.
# Kullanım: bash scripts/secret-scan.sh [dosya1 dosya2 ...] (opsiyonel dosya listesi)

set -o pipefail

PATTERNS=(
  'sk-[A-Za-z0-9]{48}'                                      # OpenAI key
  'ghp_[A-Za-z0-9]{36}'                                     # GitHub token
  'AIza[A-Za-z0-9_-]{35}'                                   # Google API key
  'AKIA[A-Z0-9]{16}'                                        # AWS access key
  'BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY'                  # Private key header
  '(key|token|secret|password)["\s:=]+[0-9a-f]{40,}'       # 40+ hex yalnız key/token/secret/password bağlamında
  '\+[1-9][0-9]{7,14}'                                      # E.164 telefon (+90... dahil)
  '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'         # E-posta
  '[-+]?[0-9]{1,3}\.[0-9]{4,},\s*[-+]?[0-9]{1,3}\.[0-9]{4,}' # GPS koordinat (lat,lon ≥4 hane)
  'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'      # JWT (3 part)
  'Bearer [A-Za-z0-9_\-\.+=]{20,}'                          # Bearer token
  '(API_?KEY|SECRET|TOKEN|PASSWORD)\s*=\s*[^<\s][^\s]{2,}' # KEY/SECRET/TOKEN/PASSWORD=<değer>
)

# E-posta allowlist
EMAIL_ALLOWLIST=(
  '@example\.com'
  '@example\.org'
  '@.*\.example'
  'cursoragent@cursor\.com'
  'noreply@cursor\.com'
  'user@example'
  'admin@sosmesh\.example'
  '@[0-9]x\.(png|jpg|pdf)$'
)

# KEY/SECRET/TOKEN/PASSWORD=<değer> eşleşmesi güvenli mi (atla)?
# Yalnız: =${VAR} / ="${VAR}" (VAR: [A-Z0-9_], :- yok) ve satırda $(openssl rand ...) üretimi.
secret_scan_skip_assignment_value() {
  local file=$1
  local match=$2
  local value="${match#*=}"

  # Tam referans: ${VAR} veya ${VAR}"
  if echo "$value" | grep -qE '^\$\{[A-Z0-9_]+\}"?$'; then
    return 0
  fi

  # openssl rand — grep -o kısaltması $(open...); satır bağlamında doğrula
  if echo "$value" | grep -qE '^\$\(open'; then
    if [ -f "$file" ] && grep -E '=\$\(openssl rand ' "$file" | grep -qF "$match"; then
      return 0
    fi
  fi
  if echo "$value" | grep -qE '^\$\(openssl rand '; then
    return 0
  fi

  return 1
}

EXIT_CODE=0
MATCH_COUNT=0

echo "=== SOSMesh Secret Scan ==="

# Dosya listesi belirleme
if [ $# -gt 0 ]; then
  FILES=("$@")
  echo "Taranıyor: ${#FILES[@]} dosya (custom list)"
else
  # Determine files to scan based on CI context or diff
  FILES=()
  DIFF_MODE=""

  if [ -n "$SECRET_SCAN_BASE_SHA" ] && [ -n "$SECRET_SCAN_HEAD_SHA" ] && ! [[ "$SECRET_SCAN_BASE_SHA" =~ ^0+$ ]]; then
    DIFF_OUTPUT=$(git diff --name-only --diff-filter=ACMR "$SECRET_SCAN_BASE_SHA" "$SECRET_SCAN_HEAD_SHA")
    DIFF_STATUS=$?
    DIFF_MODE="env SHAs diff"
  elif [ "$GITHUB_EVENT_NAME" = "pull_request" ] && [ -n "$GITHUB_BASE_REF" ]; then
    # Compare against the base branch of the PR
    DIFF_OUTPUT=$(git diff --name-only --diff-filter=ACMR "origin/$GITHUB_BASE_REF" "$GITHUB_SHA")
    DIFF_STATUS=$?
    DIFF_MODE="pull request diff"
  else
    DIFF_OUTPUT=$(git diff-tree --no-commit-id --name-only -r HEAD)
    DIFF_STATUS=$?
    DIFF_MODE="HEAD commit diff"
  fi

  while IFS= read -r FILE; do
    [ -z "$FILE" ] && continue
    if [[ "$FILE" == scripts/test-*.sh ]] || [[ "$FILE" == "pnpm-lock.yaml" ]]; then
      continue
    fi
    FILES+=("$FILE")
  done <<< "$DIFF_OUTPUT"

  # If the git diff command failed, treat as CI misconfiguration
  if [ ${DIFF_STATUS:-0} -ne 0 ]; then
    echo "Error: git $DIFF_MODE command failed."
    exit 1
  fi

  if [ ${#FILES[@]} -eq 0 ]; then
    echo "nothing to scan"
    exit 0
  fi

  echo "Scanning ${#FILES[@]} files ($DIFF_MODE)"
fi

echo ""

for PATTERN in "${PATTERNS[@]}"; do
  MATCHES=""
  
  for FILE in "${FILES[@]}"; do
    if [ ! -f "$FILE" ]; then
      continue
    fi
    
    FILE_MATCHES=$(grep -o -E "$PATTERN" "$FILE" 2>/dev/null || true)
    
    if [ -n "$FILE_MATCHES" ]; then
      while IFS= read -r MATCH; do
        if [ -n "$MATCH" ]; then
          MATCHES="$MATCHES$FILE:$MATCH"$'\n'
        fi
      done <<< "$FILE_MATCHES"
    fi
  done
  
  if [ -n "$MATCHES" ] && [ "$MATCHES" != $'\n' ]; then
    # Filtreler uygula
    FILTERED_MATCHES=""
    
    while IFS=: read -r FILE MATCH; do
      if [ -z "$MATCH" ]; then
        continue
      fi
      
      SKIP=false
      
      # 40+ hex: gerçek git commit SHA ise atla
      if [[ "$PATTERN" == '[0-9a-f]{40,}' ]]; then
        if git cat-file -e "$MATCH"^{commit} 2>/dev/null; then
          SKIP=true
        fi
      fi
      
      # E-posta: allowlist kontrolü
      if [[ "$PATTERN" == *'@'* ]]; then
        for ALLOWED_EMAIL in "${EMAIL_ALLOWLIST[@]}"; do
          if echo "$MATCH" | grep -q -E "$ALLOWED_EMAIL"; then
            SKIP=true
            break
          fi
        done
      fi
      
      # KEY/SECRET/TOKEN: placeholder, boş veya bilinen yerel/CI önekleri
      if [[ "$PATTERN" == *'KEY'* ]] || [[ "$PATTERN" == *'SECRET'* ]] || [[ "$PATTERN" == *'TOKEN'* ]]; then
        if echo "$MATCH" | grep -q -E '=\s*<|=\s*\[|=\s*$|=(dev|mock|test|ci-load|smoke-local|local-dev)-'; then
          SKIP=true
        fi
      fi

      # Tüm alternasyonlar: placeholder / boş (TOKEN/PASSWORD dahil, dev- öneki yok)
      if [[ "$PATTERN" == *'PASSWORD'* ]] || [[ "$PATTERN" == *'TOKEN'* ]]; then
        if echo "$MATCH" | grep -q -E '=\s*<|=\s*\[|=\s*$'; then
          SKIP=true
        fi
      fi

      # CI ephemeral: yalnız dar ${VAR} referansı veya $(openssl rand ...)
      if [[ "$PATTERN" == *'KEY'* ]] || [[ "$PATTERN" == *'SECRET'* ]] || [[ "$PATTERN" == *'TOKEN'* ]] || [[ "$PATTERN" == *'PASSWORD'* ]]; then
        if secret_scan_skip_assignment_value "$FILE" "$MATCH"; then
          SKIP=true
        fi
      fi
      
      if [ "$SKIP" = false ]; then
        FILTERED_MATCHES="$FILTERED_MATCHES$FILE:$MATCH"$'\n'
      fi
    done <<< "$MATCHES"
    
    if [ -n "$FILTERED_MATCHES" ] && [ "$FILTERED_MATCHES" != $'\n' ]; then
      echo "❌ PATTERN BULUNDU: $PATTERN"
      echo "$FILTERED_MATCHES" | grep -v '^$'
      MATCH_COUNT=$((MATCH_COUNT + 1))
      EXIT_CODE=1
    fi
  fi
done

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Secret scan temiz (0 gerçek secret bulundu)."
  echo "Taranan pattern sayısı: ${#PATTERNS[@]}"
else
  echo ""
  echo "⚠️  UYARI: $MATCH_COUNT farklı pattern'de potansiyel secret bulundu."
  echo "Lütfen yukarıdaki eşleşmeleri kontrol edin."
fi

exit $EXIT_CODE
