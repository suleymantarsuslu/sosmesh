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

## İmzalama

- Demo/staging/prod ayrımı ileride `xcconfig` şablonları ile genişletilecek.
- Fiziksel cihaz testi ve arka plan davranışı **NOT_TESTED** (ayrı cihaz matrisi: `docs/compat/ios-background-matrix.csv`).

## Gizlilik metinleri

Bluetooth ve konum `Info.plist` anahtarları; 112 uyarısı onboarding’de (`onboarding.not112`).

## Lint

```bash
cd apps/ios
swiftlint lint --strict
```
