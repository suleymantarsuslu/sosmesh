# Cross-Platform BLE Uyumluluk (ADIM 32)

## Ortak sabitler

| Alan | Android (`BleMeshConstants`) | iOS (`BleMeshConstants`) |
|------|------------------------------|---------------------------|
| Service UUID | `0000FFF0-0000-1000-8000-00805F9B34FB` | Aynı |
| Control | `0000FFF1-…` | Aynı |
| Data | `0000FFF2-…` | Aynı |
| Ack | `0000FFF3-…` | Aynı |
| Protocol version | `0x01` | `0x01` |

Kaynak: `docs/protocol/ble-v1.md`, `packages/ble-protocol`, `apps/android/core/ble`.

## iOS uygulama katmanı

- **Central:** `CoreBLE/BleCentralCoordinator.swift` — `CBCentralManager` + restoration identifier `com.sosmesh.ble.central`
- **Peripheral:** `CoreBLE/BlePeripheralCoordinator.swift` — GATT profili Android ile eşleşir
- **Rol seçimi:** `SOSMeshCore/BlePeerRole.swift` — pending SOS göndericiyi zorlar; relay metni okunmaz

## Doğrulama durumu

| Test | Ortam | Durum |
|------|-------|-------|
| Golden chunk/CRC (contracts) | Linux `swift test` / CI | CI job |
| Simüle transfer | `packages/ble-protocol` | PASS (repo) |
| iPhone ↔ Android 20 yönlü | Fiziksel lab | **NOT_TESTED** |
| iOS arka plan / force quit | Fiziksel | **NOT_TESTED** — garanti yok |

## Kırmızı çizgiler

- Peer `PEER_RECEIVED` ≠ sunucu `SERVER_ACCEPTED`
- Röle SOS düz metnini görmez (şifreli zarf)
- SOSMesh 112 yerine geçmez
