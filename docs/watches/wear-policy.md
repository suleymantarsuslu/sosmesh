# Wear OS companion politikası (SOSMesh)

## Kapsam

- Wear OS yalnızca **eşleşmiş Android telefona** SOS iletir (Google Play services Data Layer / `MessageClient`).
- Saat **bağımsız mesh rölesi değildir**; BLE mesh, sunucu upload veya E2E şifreleme telefonda yapılır.
- Saat arayüzü **112 yerine geçmez** ve **sunucuya ulaştı** iddiasında bulunmaz.

## Onay (ADIM 35)

- Tek dokunuş SOS yok: bas → bırak → **ikinci onay ekranı** (Gönder / İptal).
- İptal sonrası kopya: **«SOS gönderilmedi»** (sahte başarı yok).

## Wire sözleşmesi (v1)

| Yol | Yön | Açıklama |
|-----|-----|----------|
| `/sosmesh/v1/sos/create` | Saat → telefon | UTF-8 JSON `WearSosCreateWire` (`messageId`, `nonce`, …) |
| `/sosmesh/v1/sos/phone_ack` | Telefon → saat | UTF-8 JSON `WearPhoneAckWire` |
| Capability `sosmesh_phone_v1` | Telefon ilan eder | Saat erişilebilir telefon düğümünü arar |

Telefon alıcısı: `WearCompanionListenerService` → `PhoneWearSosIngress` → Android Room **outbox** (`origin=wear_os`, `sosId=messageId`).

## Offline kuyruk (ADIM 36)

- Telefon **erişilemezken** saat mesajı yerelde tutar; UI: **«Telefona ulaşılamıyor»** — **«gönderildi» denmez**.
- Yeniden deneme: `WearRetryPolicy` (5s → 15s → 60s → 5dk).
- Idempotency: aynı `messageId` ile telefon outbox’ta **tek satır**; yinelenen saat gönderimi `PHONE_OUTBOX_DUPLICATE` ACK.

## Durum senkronu

- Saat yalnızca telefon ACK ile **«Telefona kaydedildi»** (`PHONE_QUEUED`) gösterir; operatör/sunucu ACK saatten gösterilmez.
- `WearStateSyncEngine` telefon bağlantısı ile stale ACK ayrımını yapar.

## Bilinçli sınırlar (bu PR)

| Konu | Durum |
|------|--------|
| Gerçek Wear OS cihazı / emulator UI | NOT_TESTED |
| Tile / complication | ERTELENDİ (launcher + iki adımlı onay) |
| Saat reboot kalıcılığı | Bellek içi store (cihaz testi sonrası DataStore) |
| Telefon kapalıyken saat → sunucu direct path | Kapsam dışı |

## Testler

- `WearOfflineQueueTest`, `WearRetryPolicyTest`, `WearStateSyncEngine` (kuyruk testleri içinde)
- `PhoneWearSosIngressIdempotencyTest` (Robolectric + Room outbox)
