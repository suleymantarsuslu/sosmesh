# SOSMesh iOS — Kurulum (ADIM 31–33)

## Gereksinimler

- macOS 14+ ve Xcode 15.2+ (CI ile aynı)
- CocoaPods (`gem install cocoapods`)
- iOS 17 hedef sürüm

## İlk açılış

```bash
cd apps/ios
pod install
open SOSMesh.xcworkspace
```

Xcode’da **SOSMesh-iOS** şemasını seçin; Simulator veya imzalı cihazda çalıştırın.

## Paketler

| Bileşen | Konum | Açıklama |
|---------|-------|----------|
| `SOSMeshCore` | `apps/ios/SOSMeshCore` | Mesaj zarfı, outbox kuyruğu, BLE rol seçimi, restoration durum makinesi |
| `SOSMeshContracts` | `packages/contracts-swift` | Çapraz dil sözleşmeleri ve golden crypto |
| `CoreBLE` | `apps/ios/CoreBLE` | Core Bluetooth central/peripheral (yalnızca Apple platform) |

## Linux / CI (Swift Package testleri)

```bash
export SOURCE_ROOT="$(git rev-parse --show-toplevel)"
cd apps/ios/SOSMeshCore
swift test
```

Cloud agent Linux ortamında `swift-crypto` BoringSSL derlemesi araç zincirine bağlı olabilir; kanonik Swift doğrulaması GitHub-hosted `Swift Package Tests` job'ında (`swiftlang/setup-swift` + `swift test`) yapılır; macOS `ios-xcode` job uygulama derlemesini doğrular.

## İmzalama ve release (ADIM 52)

- Ortam şablonları: `apps/ios/Config/Release-*.xcconfig` — team/sertifika yalnız ortam değişkeni (`SOSMESH_APPLE_TEAM_ID`).
- Archive: `apps/ios/scripts/archive-export.sh` (**macOS gerekir**; Linux agent derleyemez).
- TestFlight yükleme: **BLOCKED_APPROVAL** — bkz. `docs/release/ios.md`.

## Gizlilik metinleri

Bluetooth ve konum: `Info.plist` + `tr.lproj` / `en.lproj` `InfoPlist.strings`; 112 uyarısı onboarding’de (`onboarding.not112`). Privacy manifest: `SOSMesh/PrivacyInfo.xcprivacy`.

## Lint

```bash
cd apps/ios
swiftlint lint --strict
```
