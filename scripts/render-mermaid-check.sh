#!/bin/bash
# Tüm docs/**/*.md içindeki mermaid bloklarını render et
# Her blok için exit kodu kontrol et, SVG commit etme

set -e

echo "=== Mermaid Render Kontrolü ==="
echo ""

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

TOTAL_BLOCKS=0
SUCCESS_COUNT=0
FAIL_COUNT=0

# Tüm .md dosyalarını bul
MD_FILES=$(find docs -name "*.md" -type f)

for MD_FILE in $MD_FILES; do
  # Mermaid bloklarını çıkar
  BLOCK_INDEX=0
  IN_MERMAID=false
  CURRENT_BLOCK=""
  LINE_NUM=0
  
  while IFS= read -r line; do
    LINE_NUM=$((LINE_NUM + 1))
    
    if echo "$line" | grep -q '```mermaid'; then
      IN_MERMAID=true
      CURRENT_BLOCK=""
      BLOCK_START=$LINE_NUM
      continue
    fi
    
    if [ "$IN_MERMAID" = true ]; then
      if echo "$line" | grep -q '```'; then
        # Blok sonu
        IN_MERMAID=false
        TOTAL_BLOCKS=$((TOTAL_BLOCKS + 1))
        
        # Geçici mermaid dosyasına yaz
        MMD_FILE="$TEMP_DIR/block-${TOTAL_BLOCKS}.mmd"
        echo "$CURRENT_BLOCK" > "$MMD_FILE"
        
        # Render et
        SVG_FILE="$TEMP_DIR/block-${TOTAL_BLOCKS}.svg"
        
        echo -n "[$TOTAL_BLOCKS] $MD_FILE:$BLOCK_START ... "
        
        if npx --yes -p @mermaid-js/mermaid-cli mmdc -i "$MMD_FILE" -o "$SVG_FILE" > /dev/null 2>&1; then
          echo "✅ başarılı"
          SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
          echo "❌ başarısız"
          FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
        
        BLOCK_INDEX=$((BLOCK_INDEX + 1))
      else
        CURRENT_BLOCK="$CURRENT_BLOCK$line"$'\n'
      fi
    fi
  done < "$MD_FILE"
done

echo ""
echo "=== Özet ==="
echo "Toplam blok: $TOTAL_BLOCKS"
echo "Başarılı: $SUCCESS_COUNT"
echo "Başarısız: $FAIL_COUNT"

if [ $FAIL_COUNT -gt 0 ]; then
  echo "❌ Bazı mermaid blokları render edilemedi"
  exit 1
else
  echo "✅ Tüm mermaid blokları başarıyla render edildi"
  exit 0
fi
