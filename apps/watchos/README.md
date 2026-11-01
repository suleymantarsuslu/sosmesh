# watchOS companion (ADIM 37–39)

Apple Watch uygulaması `apps/watchos/SOSMeshWatch`; Xcode hedefleri `apps/ios/SOSMesh.xcodeproj` içinde (`SOSMesh-Watch`, `SOSMeshWatchWidgets`).

## Özellikler

- SwiftUI iki adımlı SOS (bas-bırak → onay / iptal)
- WatchConnectivity → eşleşmiş iPhone (`PhoneWatchSosIngress`, origin=`watch_os`)
- Offline kuyruk + `WatchRetryPolicy` (5s → 15s → 60s → 5dk) — mantık `SOSMeshCore/WatchCompanion`
- WidgetKit komplikasyonu (`SOSMeshWatchWidgets`)
- Telefon yokken: «Telefona ulaşılamıyor» — sahte «gönderildi» yok; mesh garantisi iddiası yok

## Kurulum

Bkz. [docs/watchos/setup.md](../../docs/watchos/setup.md).

## Testler

Linux/CI: `cd apps/ios/SOSMeshCore && swift test` (kuyruk, retry, connectivity planner, ingress idempotency).

Gerçek Apple Watch + eşleşmiş iPhone: **NOT_TESTED** (B-04).
