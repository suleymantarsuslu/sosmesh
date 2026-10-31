# Android röle arka plan davranışı (ADIM 16)

Bu belge, gönüllü röle modunun Android arka plan kısıtları karşısındaki **beklenen** davranışını ve doğrulama durumunu özetler.

## Kapsam

- Opt-in röle anahtarı (varsayılan **kapalı**)
- Pil eşiği (%20 varsayılan; şarjda devam)
- Saatlik veri limiti (varsayılan ~5 MB)
- `connectedDevice` ön plan bildirimi (`MeshConnectionForegroundService`)
- BLE keşfi: ADIM 14 `BleScanProfile` düşük güç duty cycle
- Outbox → WorkManager `RelayUploadWorker` → `RelayIngestUplink` (HTTP ADIM 18; şu an fake/deferred)
- Röle ekranı: yalnız paket **sayısı** ve meta; payload metni yok

## JVM / Robolectric kanıtı (CI)

| Senaryo | Test sınıfı |
|--------|-------------|
| Toggle kapalı → tarama/yükleme planlanmaz | `RelaySessionControllerTest` |
| Pil eşiği altında durur; şarjda devam | `RelayBatteryPolicyTest`, `RelaySessionControllerTest` |
| Saatlik limit → upload ertelenir | `RelayBatteryPolicyTest`, `RelayUploadExecutorTest` |
| Ağ yok → retry, outbox silinmez | `RelayUploadExecutorTest` |
| Fake uplink 200 → `SERVER_ACCEPTED` | `RelayUploadExecutorTest` |
| HTTP 429 → backoff | `RelayUploadExecutorTest` |
| ViewModel state payload alanı taşımaz | `RelayUiStatePrivacyTest` |
| Kaynakta decrypt API yok | `RelayNoDecryptTest` |

## Gerçek cihaz matrisi

| Test | Durum |
|------|--------|
| Röle açık, ekran açık, BLE alım + upload | **NOT_TESTED** |
| Ekran kapalı (Doze) | **NOT_TESTED** |
| Yeniden başlatma sonrası | **NOT_TESTED** |
| OEM pil optimizasyonu / arka plan kill | **NOT_TESTED** |
| Enerji profili ölçümü | **ERTELENDİ** (ADIM 42) |

## OS kısıtları (UI metni)

Röle ekranında Doze, App Standby, üretici pil yöneticileri ve force-stop riski **gizlenmeden** anlatılır. Ön plan bildirimi bağlantının her koşulda süreceği anlamına gelmez (PRD ile uyumlu).

## Modül yerleşimi

- `apps/android/feature-relay/` — politika, oturum, upload, UI
- `apps/android/core/data/outbox/RelayOutboxReader.kt` — relay origin due listesi
- `apps/android/app/.../MeshConnectionForegroundService` — bildirim kabuğu

## ADIM 16 durumu

**PARTIAL** — mantık ve JVM testleri yeşil; fiziksel cihaz arka plan kanıtı yok.
