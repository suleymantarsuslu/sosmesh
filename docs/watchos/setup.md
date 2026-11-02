# watchOS kurulum (ADIM 37–39)

## Gereksinimler

- macOS 14+, Xcode 15.2+ (CI: `macos-latest`, `latest-stable`)
- watchOS 10+ SDK
- Eşleşmiş iPhone’da SOSMesh iOS companion (`com.sosmesh.ios`)

## Xcode

```bash
cd apps/ios
pod install
open SOSMesh.xcworkspace
```

Şemalar:

| Şema | Açıklama |
|------|----------|
| `SOSMesh-iOS` | iPhone companion + WatchConnectivity alıcı |
| `SOSMesh-Watch` | watchOS uygulama |
| `SOSMeshWatchWidgets` | WidgetKit komplikasyon extension |

CI `project.pbxproj` üretimi:

```bash
python3 apps/ios/scripts/generate-xcodeproj.py
bash apps/ios/scripts/check-xcodeproj-golden.sh
```

## Gizlilik

- SOS metni ve gerçek konum loglanmaz.
- Saat yalnızca telefon outbox ACK (`PHONE_OUTBOX_QUEUED`) ile «Telefona kaydedildi» gösterir; operatör/sunucu ACK gösterilmez.

## Apple platform sınırları (taahhüt yok)

- watchOS, uygulama arka planda veya **force-quit** edildikten sonra Watch Connectivity iletimini garanti etmez.
- Saat tek başına BLE mesh rölesi sunmaz; eşleşmiş iPhone companion kanalı esas yoldur.
- Düşük güç modu ve kilit ekranı gecikmeyi artırır; «gönderildi» yalnızca telefon outbox ACK ile gösterilir.

## Bağımlılık

ADIM 34 (iPhone outbox) main’de; dal güncellemesi için `git fetch origin && git merge origin/main`.
