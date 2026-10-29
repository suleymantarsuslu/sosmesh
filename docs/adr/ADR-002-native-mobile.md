# ADR-002: Native Mobile Platformlar

**Durum:** Kabul Edildi  
**Tarih:** 2026-10-29  
**Kapsam:** ADIM 03 (Hackathon / Çekirdek)  
**İlgili:** ADR-001 (stack), ADIM 12-16 (Android), ADIM 31-39 (iOS/watchOS)

---

## Bağlam

SOSMesh mobil uygulamaları offline BLE mesh relay ve SOS gönderimi için kritiktir. Platform-specific kısıtlamalar (iOS background, Android Doze, saat companion API) stack seçimini etkiler.

**Gereksinimler:**
- BLE scan/advertise (background mümkünse)
- Offline queue (app restart sonrası kalıcı)
- Foreground service (Android) / Background modes (iOS)
- Wear OS / watchOS companion (telefon üzerinden SOS)

---

## Karar

### 1. Android Stack

**Seçilen:** Kotlin + Jetpack Compose + Room + Kotlin Coroutines + Android Bluetooth LE API

#### Bileşenler

| Bileşen | Teknoloji | Neden |
|---------|-----------|-------|
| **Dil** | Kotlin | Null-safety, coroutines, Android modern dil |
| **UI** | Jetpack Compose | Declarative, Material 3, state management basit |
| **Storage** | Room | SQLite wrapper, compile-time SQL doğrulama, Flow/LiveData |
| **BLE** | Android Bluetooth LE API | Native, GATT server/client, scan filters |
| **Background** | Foreground Service (connectedDevice) | BLE scan için zorunlu, notification visible |
| **Async** | Kotlin Coroutines + Flow | Structured concurrency, cancel güvenli |
| **DI** | Hilt (Dagger) | Compile-time DI, ViewModel injection |

#### Özellikler

- **BLE Scan Filters:** Service UUID ile hedefli scan (pil tasarrufu)
- **GATT Server/Client:** Peripheral (SOS gönderen) + Central (relay) roller
- **Chunk Transfer:** MTU negotiation, CRC, SHA digest, retry
- **Doze Mode:** WorkManager ile periodic sync (best-effort)
- **Permission:** Bluetooth (SCAN/ADVERTISE/CONNECT), Location (Android 12+), Notification

---

### 2. iOS Stack

**Seçilen:** SwiftUI + Core Bluetooth + SwiftData (iOS 17+) / Core Data (fallback) + Async/Await

#### Bileşenler

| Bileşen | Teknoloji | Neden |
|---------|-----------|-------|
| **Dil** | Swift | Type-safe, modern, Apple first-party |
| **UI** | SwiftUI | Declarative, cross-platform (iOS/watchOS), accessibility |
| **Storage** | SwiftData (iOS 17+) / Core Data | Type-safe schema, iCloud sync opsiyonel |
| **BLE** | Core Bluetooth | Native, CBCentralManager/CBPeripheralManager |
| **Background** | Core Bluetooth state restoration | Sınırlı; force-quit sonrası garanti yok |
| **Async** | Async/Await + Combine | Structured concurrency, publisher-subscriber |

#### Özellikler

- **State Restoration:** `CBCentralManager` restore identifier ile reboot sonrası devam
- **Background Modes:** `bluetooth-central`, `bluetooth-peripheral` (Info.plist)
- **Force-Quit Sınırı:** Kullanıcı manuel force-quit yapınca background durur → UI'da açıkça belirt
- **Foreground Öncelik:** BLE scan/advertise foreground'da güvenilir, background best-effort

---

### 3. Wear OS Stack

**Seçilen:** Compose for Wear + Data Layer API (MessageClient/DataClient)

#### Bileşenler

| Bileşen | Teknoloji | Neden |
|---------|-----------|-------|
| **UI** | Compose for Wear | Round/rect screen support, Material for Wear |
| **Companion API** | Data Layer API | MessageClient (anında), DataClient (queue) |
| **Storage** | Room (Android) | Saat local queue (telefon erişilemezse) |

#### Özellikler

- **SOS → Phone:** MessageClient ile anında gönder (telefon reachable ise)
- **Phone Unreachable:** DataClient ile queue, telefon bağlantı gelince sync
- **Bağımsız Mesh Relay Yok:** Saat yalnızca telefona SOS gönderir, başka cihazlardan BLE paket almaz/iletmez
- **UI:** Tek dokunuş SOS, acil durum türü seçimi, telefon durumu göstergesi

---

### 4. watchOS Stack

**Seçilen:** SwiftUI + Watch Connectivity (WCSession)

#### Bileşenler

| Bileşen | Teknoloji | Neden |
|---------|-----------|-------|
| **UI** | SwiftUI | watchOS native, Digital Crown, haptics |
| **Companion API** | Watch Connectivity | WCSession reachability, sendMessage/transferUserInfo |
| **Storage** | SwiftData / Core Data | Saat local queue |

#### Özellikler

- **SOS → iPhone:** `sendMessage` (reachable), `transferUserInfo` (background queue)
- **Reachability:** `WCSession.default.isReachable` ile telefon durumu kontrol
- **Bağımsız Mesh Relay Yok:** watchOS yalnızca eşleşmiş iPhone'a SOS gönderir
- **Complications:** Watch face widget, quick action

---

## Platform Sınırları ve Şeffaflık

### Android

| Durum | Garanti | Kullanıcıya Bildirilen |
|-------|---------|------------------------|
| **Foreground** | ✅ BLE scan/advertise | "Relay aktif" |
| **Background (ekran kapalı)** | ⚠️ Doze/pil tasarrufu durdurabilir | "Arka plan sınırlı, pil/OEM ayarlarına bağlı" |
| **Force-stop** | ❌ Tüm servisler durur | "Uygulama kapatıldı, relay devre dışı" |

### iOS

| Durum | Garanti | Kullanıcıya Bildirilen |
|-------|---------|------------------------|
| **Foreground** | ✅ BLE scan/advertise | "Relay aktif" |
| **Background (app suspended)** | ⚠️ State restoration sınırlı | "Arka plan iOS kısıtlamaları nedeniyle sınırlı" |
| **Force-quit** | ❌ Background durur | "Uygulama kapatıldı, relay devre dışı" |

### Wear OS / watchOS

| Durum | Garanti | Kullanıcıya Bildirilen |
|-------|---------|------------------------|
| **Telefon reachable** | ✅ Anında aktarım | "Telefona aktarıldı" |
| **Telefon unreachable** | ⚠️ Queue'da bekler | "Telefona ulaşılamıyor, telefon açıldığında gönderilecek" |
| **Bağımsız mesh** | ❌ Desteklenmez | "Saat yalnızca eşleşmiş telefon üzerinden çalışır" |

---

## Alternatifler

### React Native

**Neden Reddedildi:**
- **BLE Plugin (`react-native-ble-plx`):** Bakım düzensiz, iOS background kısıtlamaları daha katı
- **iOS Force-Quit:** Plugin background task restore etmez
- **Performance:** JavaScript bridge gecikme, BLE chunk transfer yavaş
- **Debug:** Native crash native tarafta debug gerektirir, hybrid karmaşık

### Flutter

**Neden Reddedildi:**
- **BLE Plugin (`flutter_blue_plus`):** İmmatür, iOS state restoration desteklenmez
- **Dart:** Kotlin/Swift kadar olgun değil (BLE için)
- **Ekosistem:** Native library binding zor

---

## Sonuçlar

### Pozitif
- **BLE Güvenilirliği:** Native API, platform özelliklerine tam erişim
- **Performance:** Doğrudan sistem çağrısı, bridge yok
- **Debug:** Native tools (Xcode Instruments, Android Profiler)
- **OS Uyumluluğu:** Her platform için optimize edilmiş kod

### Negatif
- **Kod Tekrarı:** UI/business logic her platformda ayrı (Kotlin/Swift)
- **Ekip Yetkinliği:** 2 farklı dil (Kotlin, Swift) öğrenme eğrisi
- **Bakım:** 2 ayrı codebase, bug fix'ler platform-specific

### Riskler
- **iOS Background Sınırı:** Force-quit sonrası relay durur → kullanıcı eğitimi gerekli
- **Android Doze:** OEM-specific kısıtlamalar → test matrisi geniş (Samsung, Xiaomi, Google)
- **Wear/Watch Companion:** Telefon bağlantısı gerekli → telefon kapalıysa saat tek başına çalışmaz

---

## Karar Kriterleri

| Platform | Neden Native | Alternatif Riski |
|----------|--------------|------------------|
| **Android** | BLE scan/advertise foreground service + GATT control | RN: plugin kısıtlı, background unreliable |
| **iOS** | Core Bluetooth state restoration + iOS permissions | RN/Flutter: force-quit sonrası restore yok |
| **Wear OS** | Data Layer API direct, Compose for Wear native | RN: saat support eksik |
| **watchOS** | Watch Connectivity native, complications | Flutter: watchOS support immatür |

---

## İlgili Kararlar

- **ADR-001:** Monorepo ve stack (native tercih nedeni)
- **ADR-003:** Contracts (native platform JSON encoding)
- **ADR-004:** Secrets (mobil tarafta API key yok)

---

## Referanslar

- Master Plan §12-16: Android (iskelet, BLE, röle)
- Master Plan §31-34: iOS (SwiftUI, Core Bluetooth)
- Master Plan §35-39: Wear OS, watchOS
- PRD §6 U4: Saat SOS (companion telefon, bağımsız mesh değil)
- PRD §2.2: iOS/watchOS background kısıtlamaları
