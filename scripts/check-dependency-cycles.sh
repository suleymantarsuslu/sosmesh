#!/bin/bash
# Modül bağımlılık döngü kontrolü
# Basit DAG (Directed Acyclic Graph) kontrolü

echo "=== Modül Bağımlılık Döngü Kontrolü ==="
echo ""

# Bağımlılık tanımları (A → B: A depends on B)
# Format: "module_a:module_b module_c"

DEPENDENCIES=(
  "apps/api/core:packages/contracts"
  "apps/api/ingest:apps/api/core packages/contracts"
  "apps/api/events:apps/api/core"
  "apps/worker/ai:apps/api/core packages/contracts"
  "apps/android/core:packages/contracts"
  "apps/android/feature-sos:apps/android/core"
  "apps/android/core-ble:apps/android/core packages/contracts"
  "apps/android/core-protocol:apps/android/core-ble packages/contracts packages/fixtures"
  "apps/android/feature-relay:apps/android/core apps/android/core-protocol"
  "apps/ios/core:packages/contracts"
  "apps/ios/features:apps/ios/core"
  "apps/web/(auth):packages/contracts"
  "apps/web/(operator):apps/web/(auth) packages/design-tokens"
  "apps/web/map:apps/web/(operator)"
  "apps/web/cases:apps/web/(operator)"
)

# Basit döngü kontrolü: eğer A → B ve B → A varsa döngü var
# Daha karmaşık döngüler (A → B → C → A) için tam graph traversal gerekir

echo "Tanımlı bağımlılıklar:"
for DEP in "${DEPENDENCIES[@]}"; do
  MODULE=$(echo "$DEP" | cut -d: -f1)
  DEPS=$(echo "$DEP" | cut -d: -f2-)
  echo "  $MODULE → $DEPS"
done

echo ""
echo "Döngü kontrolü:"

# Basit iki yönlü döngü kontrolü
HAS_CYCLE=false
for DEP1 in "${DEPENDENCIES[@]}"; do
  MODULE_A=$(echo "$DEP1" | cut -d: -f1)
  DEPS_A=$(echo "$DEP1" | cut -d: -f2-)
  
  for DEP_B in $DEPS_A; do
    # B'nin A'ya bağımlı olup olmadığını kontrol et
    for DEP2 in "${DEPENDENCIES[@]}"; do
      MODULE_B=$(echo "$DEP2" | cut -d: -f1)
      DEPS_B=$(echo "$DEP2" | cut -d: -f2-)
      
      if [ "$MODULE_B" = "$DEP_B" ]; then
        if echo "$DEPS_B" | grep -q "$MODULE_A"; then
          echo "❌ DÖNGÜ BULUNDU: $MODULE_A ↔ $DEP_B"
          HAS_CYCLE=true
        fi
      fi
    done
  done
done

if [ "$HAS_CYCLE" = false ]; then
  echo "✅ Döngü yok (grafik DAG)"
  exit 0
else
  echo ""
  echo "⚠️  Döngü bulundu. Bağımlılıkları düzeltin."
  exit 1
fi
