#!/bin/bash
# Test script for check-dependency-cycles.js
# Geçici bir md dosyasında döngü oluşturur ve tespitin çalıştığını doğrular

set -e

echo "=== Dependency Cycles Negatif Test ==="
echo ""

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

TEMP_MD="$TEMP_DIR/test-modules.md"

# Test 1: Döngülü grafik (A→B→C→A)
cat > "$TEMP_MD" << 'EOF'
# Test Modules

## Bağımlılık Grafiği

```mermaid
graph TD
    A[Module A]
    B[Module B]
    C[Module C]
    
    A --> B
    B --> C
    C --> A
```
EOF

echo "Test 1: Döngülü grafik (A→B→C→A)"

# Geçici olarak modules.md'yi yedekle
BACKUP_MD="/tmp/modules-backup-$$.md"
cp docs/architecture/modules.md "$BACKUP_MD"

# Geçici dosyayı modules.md yerine kopyala
cp "$TEMP_MD" docs/architecture/modules.md

# Test çalıştır (exit 1 bekleniyor)
set +e
node scripts/check-dependency-cycles.js > /dev/null 2>&1
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 0 ]; then
  echo "❌ Test 1 başarısız: Döngü tespit edilmeliydi"
  cp "$BACKUP_MD" docs/architecture/modules.md
  rm "$BACKUP_MD"
  exit 1
else
  # Döngü mesajını kontrol et
  OUTPUT=$(node scripts/check-dependency-cycles.js 2>&1 || true)
  if echo "$OUTPUT" | grep -q "Döngü"; then
    echo "✅ Test 1 başarılı: Döngü tespit edildi"
    echo "   Döngü yolu: $(echo "$OUTPUT" | grep "Döngü 1:" | head -1)"
  else
    echo "❌ Test 1 başarısız: Döngü mesajı bulunamadı"
    cp "$BACKUP_MD" docs/architecture/modules.md
    rm "$BACKUP_MD"
    exit 1
  fi
fi

# Orijinal modules.md'yi geri yükle
cp "$BACKUP_MD" docs/architecture/modules.md
rm "$BACKUP_MD"

echo ""

# Test 2: Döngüsüz grafik (A→B, C→D)
cat > "$TEMP_MD" << 'EOF'
# Test Modules

```mermaid
graph TD
    A[Module A]
    B[Module B]
    C[Module C]
    D[Module D]
    
    A --> B
    C --> D
```
EOF

echo "Test 2: Döngüsüz grafik"

cp docs/architecture/modules.md "$BACKUP_MD"
cp "$TEMP_MD" docs/architecture/modules.md

if node scripts/check-dependency-cycles.js > /dev/null 2>&1; then
  echo "✅ Test 2 başarılı: Döngü yok"
else
  echo "❌ Test 2 başarısız: Döngüsüz grafikte hata"
  cp "$BACKUP_MD" docs/architecture/modules.md
  rm "$BACKUP_MD"
  exit 1
fi

cp "$BACKUP_MD" docs/architecture/modules.md
rm "$BACKUP_MD"

echo ""
echo "=== Tüm Testler Başarılı ==="
exit 0
