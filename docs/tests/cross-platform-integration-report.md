# iOS ↔ Android çapraz entegrasyon raporu (ADIM 34)

**Ortam:** Sözleşme + simülatör/JVM testleri PASS; fiziksel iPhone↔Android senaryoları **NOT_TESTED**.

## Paylaşılan fixture kaynakları

| Dosya | Amaç |
|-------|------|
| `packages/fixtures/cross-platform/transfer-ack-gate.json` | PEER_RECEIVED yalnızca `transferVerified`; SHA/digest/CRC redleri |
| `packages/fixtures/cross-platform/encrypted-payload-fixtures.json` | Sentetik şifreli zarf referansları (golden-001, opaque mesh blob) |
| `packages/fixtures/cross-platform/relay-scenarios.json` | iPhone↔Android yön senaryoları; fiziksel satırlar NOT_TESTED |
| `packages/fixtures/ble/test-vectors.json` | CRC/SHA/chunk parity (TS/Kotlin/Swift) |

## Test kanıtı (simüle / CI)

| Katman | Test | Sonuç |
|--------|------|-------|
| TS | `packages/contracts/src/cross-platform/ack-delivery-gate.test.ts` | PASS (yerel) |
| Kotlin | `CrossPlatformAckGateFixtureTest` | PASS (Gradle) |
| Swift | `CrossPlatformAckGateFixtureTests`, `MeshRelayEngineCrossLanguageTests` | CI Swift Package Tests |
| BLE | `packages/ble-protocol` digest/CRC gate | PASS (repo) |
| Mutation | `peerReceivedIfIgnoringVerified` ≠ production gate | PASS |

## Hata UX (Compose + SwiftUI)

| Durum | Android | iOS |
|-------|---------|-----|
| Bluetooth kapalı | `PlatformSelfRepairCard` | `CrossPlatformFaultBanner` |
| İzin yok | aynı | aynı |
| GPS/konum yok | `CrossPlatformFaultCard` | aynı |
| Bozuk paket | `CrossPlatformFaultCard` | aynı |
| API yükleme hatası | `CrossPlatformFaultCard` | aynı |

Erişilebilirlik: TalkBack/VoiceOver için `contentDescription` / `accessibilityLabel` anahtarları eklendi; fiziksel VoiceOver doğrulaması **NOT_TESTED**.

## Uyumluluk gridi

`docs/compat/cross-platform-matrix.csv` — tüm fiziksel satırlar **NOT_TESTED**.

## Kırmızı çizgiler (doğrulandı)

- `PEER_RECEIVED` ≠ `SERVER_ACCEPTED` (fixture + mutation)
- Röle düz metin görmez (mesh v2 opaque ciphertext)
- SOSMesh 112 yerine geçmez (onboarding metni)

## Ertelenen

- 30 senaryo fiziksel lab (2+ cihaz)
- iPhone SE / büyük Dynamic Type ekran görüntüleri
- Gerçek GPS koordinatı loglama (yasak — repoda yok)
