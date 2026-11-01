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

## Bağımlılık

ADIM 34 (iPhone outbox / çapraz entegrasyon) PR [#48](https://github.com/suleymantarsuslu/sosmesh/pull/48) main’e girince `git fetch origin && git merge origin/main` ile alın.
