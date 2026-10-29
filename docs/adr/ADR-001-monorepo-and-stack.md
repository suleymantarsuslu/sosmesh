# ADR-001: Monorepo ve Teknoloji Stack

**Durum:** Kabul Edildi  
**Tarih:** 2026-10-29  
**Kapsam:** ADIM 03 (Hackathon / Çekirdek)  
**İlgili:** ADIM 05 (monorepo iskelet), ADIM 17 (backend), ADIM 21 (web panel)

---

## Bağlam

SOSMesh, mobil (Android/iOS), saat (Wear OS/watchOS), web panel ve backend API'den oluşan çapraz platform bir acil durum mesh ağıdır. Tek bir repo'da tutarlı geliştirme, ortak tip paylaşımı ve senkronize release için karar gerekir.

**Gereksinimler:**
- Offline BLE erişimi (Android/iOS native gerektirir)
- Gerçek zamanlı operator panel (web)
- API ingest + Meta AI sınıflandırma (backend)
- Ortak sözleşme (JSON Schema → üretilmiş tipler)
- M0: 2 fiziksel Android + API + web demo

---

## Karar

### 1. Monorepo Yapısı

**Seçilen:** pnpm workspace + lerna (opsiyonel versiyonlama için)

**Neden:**
- Ortak bağımlılıklar tek yerde (`packages/contracts`, `packages/fixtures`)
- Atomik commit'ler (web + API + schema değişikliği tek PR'da)
- TypeScript tip paylaşımı kolay
- CI tek pipeline'da tüm bileşenleri test eder

**Alternatifler:**
- **Yarn workspaces:** pnpm daha hızlı, disk kullanımı düşük
- **Nx/Turborepo:** Ek karmaşıklık; M0 için overkill
- **Polirepo (her bileşen ayrı):** Sözleşme senkronizasyonu zor, atomik değişiklik yok

**Seçim:** pnpm (hız, peer dependency çözümü)

---

### 2. Backend Stack

**Seçilen:** NestJS + TypeScript + PostgreSQL + Prisma + (Redis opsiyonel)

**Neden:**
- **NestJS:** Modüler mimari, DI, OpenAPI üretimi, ölçeklenebilir
- **TypeScript:** Tip güvenliği, frontend/backend paylaşımı
- **PostgreSQL:** ACID, JSONB, GIS (konum), production-ready
- **Prisma:** Type-safe ORM, migration, introspection, client üretimi
- **Redis:** Yalnızca gerekirse (SSE/WebSocket session, rate limit); M0'da opsiyonel

**Alternatifler:**
- **Express.js + manual schema:** Tip güvenliği yok, OpenAPI manuel
- **Django/FastAPI:** Python; TypeScript paylaşımı zor, BLE native binding karmaşık
- **Go/Rust:** Performans yüksek ama TypeScript ekosisteminden izole

**Seçim:** NestJS (TypeScript ekosistemi, OpenAPI, hız yeterli)

---

### 3. Web Panel Stack

**Seçilen:** Next.js 14+ (App Router) + TypeScript + Tailwind CSS + shadcn/ui

**Neden:**
- **Next.js App Router:** SSR/SSG, API routes, modern React, SEO
- **TypeScript:** Backend ile tip paylaşımı
- **Tailwind:** Hızlı stil, mobil responsive, dark mode
- **shadcn/ui:** Primitives (Button, Dialog, Table), erişilebilir, customizable

**Alternatifler:**
- **Vite + React:** SSR yok; operatör paneli SEO gerektirmez ama Next.js API routes kullanışlı
- **Vue/Svelte:** TypeScript ekosistemi React kadar olgun değil
- **React Native Web:** BLE native gerekli, web için overkill

**Seçim:** Next.js (SSR, API routes, geniş ekosistem)

---

### 4. Native Mobile Stack

**Seçilen:** 
- **Android:** Kotlin + Jetpack Compose + Room + Kotlin Coroutines + Core Bluetooth
- **iOS:** SwiftUI + Core Data/SwiftData + Async/Await + Core Bluetooth
- **Wear OS:** Compose for Wear + Data Layer API
- **watchOS:** SwiftUI + Watch Connectivity

**Neden:**
- **Native BLE API gerekli:** Core Bluetooth (iOS), Android Bluetooth LE API
- **React Native / Flutter BLE eklentisi riski:**
  - RN: `react-native-ble-plx` bakım düzensiz, iOS background kısıtları daha katı
  - Flutter: `flutter_blue_plus` iOS force-quit sonrası garanti yok
  - Native: Doğrudan platform API, debug kolay, performans yüksek
- **Offline storage:** Room (Android), SwiftData (iOS) — SQL-based, query güçlü
- **UI:** Compose/SwiftUI modern, declarative, hızlı iterasyon

**Alternatifler:**
- **React Native:** JavaScript bridge performans düşük, BLE eklentisi güvenilmez, iOS background sınırlamaları aşamaz
- **Flutter:** Dart, BLE plugin immatür, iOS arka plan çalışma garantisi yok
- **Cordova/Capacitor:** Hybrid, BLE performansı kötü, UX native değil

**Seçim:** Native (Kotlin/Swift) — BLE güvenilirliği kritik, platform özelliklerine tam erişim

---

### 5. Gerçek Zamanlı İletişim

**Seçilen:** SSE (Server-Sent Events) + WebSocket fallback

**Neden:**
- **SSE:** Tek yönlü (server → client), basit, HTTP/2 üzerinde çalışır, reconnect otomatik
- **WebSocket:** İki yönlü, SSE desteklenmezse fallback
- **M0 kapsamı:** Operator panel feed (yeni SOS'lar) → SSE yeterli

**Alternatifler:**
- **Polling:** Gecikme yüksek, sunucu yükü fazla
- **GraphQL Subscriptions:** Ek karmaşıklık, M0 için overkill

**Seçim:** SSE (basitlik, HTTP/2 uyumlu)

---

### 6. Sözleşme ve Tip Üretimi

**Seçilen:** JSON Schema (tek kaynak) → OpenAPI (API) + TypeScript (web/backend) + Kotlin data class (Android) + Swift Codable (iOS)

**Neden:**
- **JSON Schema:** Platform-agnostic, validation, documentation
- **OpenAPI:** Swagger UI, client SDK üretimi, test fixture'ları
- **Üretilmiş tipler:** Compile-time tip güvenliği, manuel sync hatası yok

**Alternatifler:**
- **Protobuf:** Binary serialization hızlı ama web browser desteği zayıf, debug zor
- **GraphQL:** Tip sistemi güçlü ama M0 için karmaşık, BLE üzerinde kullanışsız

**Seçim:** JSON Schema + OpenAPI (web/API uyumlu, debug kolay)

---

## Sonuçlar

### Pozitif
- **Tip güvenliği:** TypeScript/Kotlin/Swift tipleri JSON Schema'dan üretilir
- **Hızlı iterasyon:** Ortak sözleşme değişikliği tüm platformlara yayılır
- **Monorepo:** Atomik değişiklikler, CI tek pipeline
- **Native BLE:** iOS/Android background, power management, platform özelliklerine tam erişim

### Negatif
- **Çoklu dil:** Kotlin + Swift + TypeScript — ekip her dilde deneyimli olmalı
- **Build karmaşıklığı:** Android Gradle, iOS Xcode, pnpm workspace — CI setup karmaşık
- **Native kod paylaşımı yok:** UI/business logic her platformda tekrar yazılır (React Native ile ortak UI olabilirdi)

### Riskler
- **iOS background kısıtlamaları:** Core Bluetooth state restoration sınırlı; force-quit sonrası relay garantisi yok → kullanıcıya açıkça bildir
- **BLE performans:** Chunk transfer, MTU negotiation, packet loss handling native kodda karmaşık → ADIM 11 radyo simülatörü ile test
- **Monorepo büyüme:** Zaman içinde build süresi artabilir → Nx/Turborepo geçişi gelecekte

---

## Karar Kriterleri

| Kriter | Ağırlık | NestJS+Next+Native | RN+Express | Flutter+FastAPI |
|--------|---------|-------------------|-----------|----------------|
| **Offline BLE erişimi** | 🔥🔥🔥 | ✅ Native API | ⚠️ Plugin risk | ⚠️ Plugin risk |
| **Hız (geliştirme)** | 🔥🔥 | ⚠️ 3 dil | ✅ JS paylaşımı | ✅ Dart paylaşımı |
| **Kapasite (ölçeklenebilirlik)** | 🔥🔥 | ✅ NestJS modüler | ⚠️ Express manuel | ✅ FastAPI async |
| **Tip güvenliği** | 🔥🔥 | ✅ TS+Kotlin+Swift | ⚠️ JS tip yok | ✅ Dart strong |
| **Ekosistem (lib/araç)** | 🔥 | ✅ Geniş | ✅ Geniş | ⚠️ İmmatür |
| **iOS background garanti** | 🔥🔥🔥 | ✅ Native API | ❌ Plugin sınırlı | ❌ Plugin sınırlı |

**Sonuç:** NestJS+Next.js+Native (BLE güvenilirliği kritik; tip paylaşımı sağlanır)

---

## İlgili Kararlar

- **ADR-002:** Native mobile detayları (Kotlin/Swift)
- **ADR-003:** Contracts ve fixtures (JSON Schema)
- **ADR-004:** Secrets ve deployment sınırları

---

## Referanslar

- Master Plan §05: Monorepo, standartlar ve local geliştirme
- Master Plan §17: Backend iskelet ve veri modeli
- Master Plan §21: Koordinasyon paneli temeli ve güvenli oturum
- PRD §5: M0 vs M1 vs Tam Ürün (Android M0, iOS M1)
