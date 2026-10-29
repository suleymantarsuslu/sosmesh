#!/bin/bash
# Tüm docs/**/*.md içindeki mermaid bloklarını render et
# Stdin tükenmesini önlemek için önce blokları çıkar, sonra render et

set -e

echo "=== Mermaid Render Kontrolü ==="
echo ""

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Önce beklenen blok sayısını hesapla
EXPECTED_COUNT=$(grep -r '```mermaid' docs --include="*.md" | wc -l)
echo "Beklenen mermaid blok sayısı: $EXPECTED_COUNT"
echo ""

# Tüm mermaid bloklarını çıkar ve ayrı dosyalara yaz (node ile)
node << 'EOF_NODE' > "$TEMP_DIR/blocks.json"
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Tüm .md dosyalarını bul
const mdFiles = execSync('find docs -name "*.md" -type f', { encoding: 'utf-8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const blocks = [];

mdFiles.forEach(mdFile => {
  const content = fs.readFileSync(mdFile, 'utf-8');
  const lines = content.split('\n');
  
  let inMermaid = false;
  let blockStart = 0;
  let blockContent = [];
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    
    if (line.trim() === '```mermaid') {
      inMermaid = true;
      blockStart = lineNum;
      blockContent = [];
      return;
    }
    
    if (inMermaid) {
      if (line.trim() === '```') {
        // Blok sonu
        blocks.push({
          file: mdFile,
          line: blockStart,
          content: blockContent.join('\n')
        });
        inMermaid = false;
      } else {
        blockContent.push(line);
      }
    }
  });
});

console.log(JSON.stringify(blocks, null, 2));
EOF_NODE

# JSON'dan blokları oku ve render et
TOTAL_BLOCKS=0
SUCCESS_COUNT=0
FAIL_COUNT=0

while IFS= read -r block; do
  FILE=$(echo "$block" | jq -r '.file')
  LINE=$(echo "$block" | jq -r '.line')
  CONTENT=$(echo "$block" | jq -r '.content')
  
  TOTAL_BLOCKS=$((TOTAL_BLOCKS + 1))
  
  # Geçici mermaid dosyasına yaz
  MMD_FILE="$TEMP_DIR/block-${TOTAL_BLOCKS}.mmd"
  echo "$CONTENT" > "$MMD_FILE"
  
  # Render et (stdin tükenmesini önle)
  SVG_FILE="$TEMP_DIR/block-${TOTAL_BLOCKS}.svg"
  
  echo -n "[$TOTAL_BLOCKS] $FILE:$LINE ... "
  
  if npx --yes -p @mermaid-js/mermaid-cli mmdc -i "$MMD_FILE" -o "$SVG_FILE" < /dev/null > /dev/null 2>&1; then
    echo "✅ başarılı"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "❌ başarısız"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done < <(jq -c '.[]' "$TEMP_DIR/blocks.json")

echo ""
echo "=== Özet ==="
echo "Beklenen: $EXPECTED_COUNT"
echo "Render edilen: $TOTAL_BLOCKS"
echo "Başarılı: $SUCCESS_COUNT"
echo "Başarısız: $FAIL_COUNT"

if [ $TOTAL_BLOCKS -ne $EXPECTED_COUNT ]; then
  echo "❌ Render edilen blok sayısı beklenenle eşleşmiyor"
  exit 1
fi

if [ $FAIL_COUNT -gt 0 ]; then
  echo "❌ Bazı mermaid blokları render edilemedi"
  exit 1
fi

echo "✅ Tüm mermaid blokları başarıyla render edildi ($TOTAL_BLOCKS/$EXPECTED_COUNT)"
exit 0
