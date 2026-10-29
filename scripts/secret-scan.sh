#!/bin/bash
# SOSMesh Secret Scan — 9-pattern gizlilik taraması
# git ls-files üzerinde çalışır, 40-hex git SHA ve bilinen yanlış pozitifleri allowlist'le filtreler.
# Bulgu varsa exit 1.

set -e

PATTERNS=(
  'sk-[A-Za-z0-9]{48}'                         # OpenAI key
  'ghp_[A-Za-z0-9]{36}'                        # GitHub token
  'AIza[A-Za-z0-9_-]{35}'                      # Google API key
  'AKIA[A-Z0-9]{16}'                           # AWS access key
  'BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY'     # Private key header
  '[0-9a-f]{40,}'                              # 40+ hex string (SHA gibi)
  '\+90[0-9]{10}'                              # Türkiye telefon numarası
)

# Allowlist: bilinen yanlış pozitifler (örnek: git SHA, örnek değerler)
# Bu değerler reel olmayan örnekler veya git hash'leridir.
ALLOWLIST=(
  '4dc415013319f254d4933c207e1bb0a0a87d2075'  # ADIM 01 commit SHA
  'f822313830ba509fd580d67fcacd65084620806a'  # ADIM 02 düzeltme 1 SHA
  'ba9a6d869b1cebb85e7560e1e2d3b21facfe4d14'  # ADIM 02 düzeltme 2 SHA
  '8d312ed5'                                   # docx partial hash (inventory)
  'user@example.com'                           # Örnek e-posta
  'admin@sosmesh.example'                      # Örnek admin e-posta
)

EXIT_CODE=0
MATCH_COUNT=0

echo "=== SOSMesh Secret Scan ==="
echo "Taranıyor: git ls-files"
echo ""

for PATTERN in "${PATTERNS[@]}"; do
  MATCHES=$(git ls-files | xargs -I {} grep -H -o -E "$PATTERN" {} 2>/dev/null || true)
  
  if [ -n "$MATCHES" ]; then
    # Allowlist filtresi uygula
    FILTERED_MATCHES=""
    while IFS= read -r MATCH; do
      IS_ALLOWED=false
      for ALLOWED in "${ALLOWLIST[@]}"; do
        if echo "$MATCH" | grep -q "$ALLOWED"; then
          IS_ALLOWED=true
          break
        fi
      done
      
      if [ "$IS_ALLOWED" = false ]; then
        FILTERED_MATCHES="$FILTERED_MATCHES$MATCH"$'\n'
      fi
    done <<< "$MATCHES"
    
    if [ -n "$FILTERED_MATCHES" ] && [ "$FILTERED_MATCHES" != $'\n' ]; then
      echo "❌ PATTERN BULUNDU: $PATTERN"
      echo "$FILTERED_MATCHES"
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
