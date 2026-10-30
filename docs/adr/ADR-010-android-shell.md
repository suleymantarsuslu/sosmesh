# ADR-010: Android uygulama iskeleti (ADIM 12)

**Durum:** Kabul edildi  
**Tarih:** 2026-10-30

## Bağlam

SOSMesh Android istemcisi native BLE, Room outbox ve Compose UI gerektirir. ADIM 12 yalnızca iskelet, izin matrisi ve CI doğrulamasını kapsar.

## Kararlar

### Bağımlılık enjeksiyonu: Hilt

- **Seçilen:** Dagger Hilt  
- **Alternatif:** Koin — daha az boilerplate, fakat resmi Android dokümantasyonu ve `@AndroidEntryPoint` entegrasyonu Hilt lehine.  
- **Sonuç:** `apps/android/app` + `core:*` modüllerde Hilt; testlerde manuel fake/coordinator.

### SDK sürümleri

| Alan | Değer | Gerekçe |
|------|-------|---------|
| minSdk | 26 (Android 8.0) | PRD/ADR-002; BLE ve Room desteği |
| targetSdk | 35 | Play uyumu; Android 14/15 izin/FGS kuralları test edilebilir |
| compileSdk | 35 | Derleme API eşlemesi |

### Modül yapısı

- `:app` — Compose, Navigation, FGS iskeleti  
- `:core:model` — paylaşılan sabitler  
- `:core:data` — Room `OutboxQueueAdapter`, Keystore prefs  
- `:core:permissions` — izin matrisi + Compose izin UI  
- `:core:ble` — yalnız arayüz/iskelet (ADIM 14)  
- `:contracts-kotlin` — monorepo JVM sözleşmeleri (kopyalanmaz)

## Sonuçlar

- JVM `contracts-kotlin` Android modüllerine `implementation(project(...))` ile bağlanır; `sqlite-jdbc` APK'ya dahil edilmez (exclude).  
- Gerçek cihaz, enstrümantasyon ve Keystore donanım kanıtı CI dışında **NOT_TESTED** olarak işaretlenir.
