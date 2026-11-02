# iOS çok atlama (multi-hop) uyumluluk araştırması (ADIM 41)

## Kapsam

Bu belge **deneysel** iPhone katılımını tanımlar. Üretim iddiası yoktur; yalnızca test edilen kombinasyonlar destek listesine girebilir.

## Mimari

| Bileşen | Konum | Not |
|---------|-------|-----|
| Mesh relay motoru | `apps/ios/SOSMeshCore/Sources/SOSMeshCore/MeshRelayEngine.swift` | Kotlin/TS ile aynı `relay-engine-cases.json` vektörleri |
| Foreground koordinatör | `MeshMultihopRelayCoordinator.swift` | Feature flag kapalıyken `nil` döner |
| Feature flag | `MeshRelayFeatureFlags` | Kullanıcı ayarı; guard skip **public API'de yok** |
| Android mesh v2 | `apps/android/mesh-v2` | Protokol v2 zarfı; iOS yalnızca motor parity |

## Feature flag politikası

- Varsayılan: **kapalı** (`UserDefaults` `sosmesh.experimental.multihop.enabled`).
- Açıkken: yalnızca **ön planda** Core Bluetooth ile sınırlı değerlendirme; arka plan röle garantisi verilmez.
- Guard bayrakları (`skipTtlDecrement`, vb.) yalnızca `#if DEBUG` test modülünde; production ctor her zaman tam guard.

## Apple / Android yaşam döngüsü matrisi

| Durum | iPhone relay beklentisi | Android katılımcı | Kanıt |
|-------|-------------------------|-------------------|-------|
| Foreground | Sınırlı forward değerlendirme mümkün | mesh-v2 coordinator | Simüle vektör PASS; fiziksel **NOT_TESTED** |
| Background | OS kısıtı; garanti yok | FGS + OEM matrisi | `docs/compat/ios-background-matrix.csv` NOT_TESTED |
| Force quit | Terminal; relay durur | OEM kill | BleRestorationStateMachine unit PASS |
| Locked screen | Kısıtlı; ayrı test gerekir | Doze matrisi | NOT_TESTED |

## Wi‑Fi Aware / alternatifler

Resmi API + cihaz matrisi olmadan etkinleştirilmez. Ayrı feature flag gerekir; bu ADIM kapsamında **NOT_STARTED**.

## Ürün sınırları (README ile uyumlu)

- iPhone **7/24 mesh tekrarlayıcı** varsayılmaz.
- `peerAckHint: PEER_RECEIVED_ONLY` operatör/kurtarma tamamlanması değildir.
- Arka plan ve force-quit: `apps/ios/README.md` ve Ayarlar ekranı footer metni.

## Doğrulama

| Test | Ortam | Durum |
|------|-------|-------|
| `MeshRelayEngineCrossLanguageTests` | Swift PM / CI | PASS (vektör dosyası) |
| `MeshRelayEngineMutationTests` (DEBUG) | Swift | PASS |
| 3 cihaz foreground zinciri | Fiziksel | **NOT_TESTED** |
| Locked / force-quit video | Fiziksel | **NOT_TESTED** |

## Sonraki adımlar (onay gerektirir)

1. Fiziksel iPhone + 2 Android A→B→C zinciri (foreground).
2. TestFlight build ile background matris satırlarını doldurma.
3. ADIM 34 fiziksel çapraz BLE tamamlandıktan sonra native BLE v2 handoff.
