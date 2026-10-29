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
  '[0-9a-f]{40,}'                                           # 40+ hex (SHA kontrolü yapılacak)
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
)

EXIT_CODE=0
MATCH_COUNT=0

echo "=== SOSMesh Secret Scan ==="

# Dosya listesi belirleme
if [ $# -gt 0 ]; then
  FILES=("$@")
  echo "Taranıyor: ${#FILES[@]} dosya (custom list)"
else
  # git ls-files'tan yalnız test script'leri hariç tut
  mapfile -d '' ALL_FILES < <(git ls-files -z 2>/dev/null || find . -type f -print0)
  FILES=()
  for FILE in "${ALL_FILES[@]}"; do
    # Yalnız scripts/test-*.sh hariç tut (ADR-004 dahil tüm md'ler taranmalı)
    if [[ "$FILE" == scripts/test-*.sh ]]; then
      continue
    fi
    FILES+=("$FILE")
  done
  echo "Taranıyor: git ls-files (${#FILES[@]} dosya, test script'ler hariç)"
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
      
      # KEY/SECRET/PASSWORD: değer <placeholder>, boş, veya dev-/mock- prefix'li ise atla
      if [[ "$PATTERN" == *'KEY'* ]] || [[ "$PATTERN" == *'SECRET'* ]]; then
        if echo "$MATCH" | grep -q -E '=\s*<|=\s*\[|=\s*$|=(dev|mock|test)-'; then
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
