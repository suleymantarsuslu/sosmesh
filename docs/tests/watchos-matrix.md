# watchOS test matrisi (ADIM 38)

| Senaryo | Beklenen UI / davranış | Otomasyon | Cihaz |
|---------|------------------------|-----------|-------|
| İki adımlı SOS onayı | İptal → «SOS gönderilmedi» | `WatchStateSyncEngineTests` | NOT_TESTED |
| Telefon erişilebilir | `sendMessage` denemesi | `WatchConnectivitySendPlannerTests` | NOT_TESTED |
| Telefon erişilemez | «Telefona ulaşılamıyor», kuyruk | `WatchOfflineQueueTests` | NOT_TESTED |
| Düşük güç | `transferUserInfo`, sahte başarı yok | planner test | NOT_TESTED |
| Telefon ACK | «Telefona kaydedildi», sunucu iddiası yok | `WatchStateSyncEngineTests` | NOT_TESTED |
| Yinelenen tap / messageId | Tek outbox satırı | `PhoneWatchSosIngressTests` | NOT_TESTED |
| Komplikasyon tap | Uygulama açılır, iki adım | — | NOT_TESTED |
| Saat reboot | Bellek kuyruğu (kalıcılık sonraki iterasyon) | kuyruk birim testleri | NOT_TESTED |

## JVM / Swift çapraz referans

Wear OS eşdeğerleri: `WearOfflineQueueTest`, `WearStateSyncEngine`, `docs/watches/wear-policy.md`.
