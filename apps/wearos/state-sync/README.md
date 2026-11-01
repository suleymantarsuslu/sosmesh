# Wear OS state-sync (ADIM 36)

Uygulama kodu:

- `apps/android/core/wear-companion/.../queue/WearOfflineQueue.kt` — saat tarafı bekleyen mesajlar, yeniden deneme
- `apps/android/core/wear-companion/.../sync/WearStateSyncEngine.kt` — telefon ACK / bağlantı ayrımı, sahte başarı yok
- `apps/android/core/wear-companion/.../watch/WearSosCoordinator.kt` — gönderim + ACK birleşimi
- `apps/android/wear/.../companion/WearPhoneAckListenerService.kt` — telefon ACK dinleyicisi

Politika özeti: `docs/watches/wear-policy.md`
