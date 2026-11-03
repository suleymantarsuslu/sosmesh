# iOS / watchOS gerçek cihaz ve TestFlight kapısı (ADIM 52)

**Durum:** Kod/yapılandırma/belge hazır — fiziksel cihaz, imzalama ve TestFlight yükleme **BLOCKED_APPROVAL** (kullanıcı onayı gerekir).

**Kırmızı çizgiler:** SOSMesh 112 yerine geçmez; offline BLE AI’sız çalışır; röle SOS metnini görmez; peer ACK ≠ operatör okundu; Apple arka plan / force-quit için mesh relay **garanti verilmez**.

## Bu ortam (Cloud Agent / Linux)

| Kapı | Sonuç | Not |
|------|--------|-----|
| `pnpm -r build` | EXIT 0 | Monorepo (denetçi 2026-11-02) |
| `pnpm test` | EXIT 0 | |
| `bash scripts/verify.sh` | 27/27 EXIT 0 | golden pbxproj + `check-release-adim52.sh` + mutation test |
| `packages/contracts-kotlin ./gradlew test` | **NOT_TESTED** | Bu VM'de JDK 17 toolchain yok — CI `contracts-kotlin` job doğrular |
| `xcodebuild archive` / imzalı IPA | **YOK** | macOS + Xcode + Apple Developer hesabı gerekir |
| TestFlight | **BLOCKED_APPROVAL** | Transporter / App Store Connect yüklemesi yapılmadı |
| Fiziksel iPhone / Apple Watch testleri | **NOT_TESTED** | MacBook + cihaz aşamasında |

## Release yapılandırması (`apps/ios`)

| Bileşen | Dosya |
|---------|--------|
| Sürüm | `Config/Version.xcconfig` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`) |
| Ortam xcconfig | `Config/Release-{Demo,Staging,Prod}.xcconfig` |
| Paylaşılan release | `Config/SharedRelease.xcconfig` — yalnız **env adları**: `SOSMESH_APPLE_TEAM_ID`, `SOSMESH_CODE_SIGN_IDENTITY` |
| Entitlements | `SOSMesh/SOSMesh.entitlements` (boş sözlük — BLE arka plan **yalnızca** `Info.plist` `UIBackgroundModes`) |
| iOS gizlilik manifesti | `SOSMesh/PrivacyInfo.xcprivacy` |
| watchOS gizlilik | `apps/watchos/SOSMeshWatch/PrivacyInfo.xcprivacy`, `SOSMeshWatchWidgets/PrivacyInfo.xcprivacy` |
| İzin metinleri TR/EN | `SOSMesh/tr.lproj/InfoPlist.strings`, `en.lproj/InfoPlist.strings` + taban `Info.plist` (`NSBluetoothAlwaysUsageDescription` — TR). Bildirimler sistem diyaloğu; geçersiz `NSUserNotificationsUsageDescription` plist anahtarı kullanılmaz. Konum şu an uygulamada toplanmadığı için When-In-Use plist anahtarı yok. |
| Açılış izin kapısı | Bluetooth + bildirimler (konum zorunlu değil); `PermissionGateEvaluator` unit test |
| Archive + export | `scripts/archive-export.sh`, `scripts/ExportOptions.template.plist` |

### Capabilities / arka plan gözden geçirmesi

`UIBackgroundModes` (**yalnız gerekli olanlar**):

- `bluetooth-central` — gönderici / tarayıcı rolü
- `bluetooth-peripheral` — relay GATT sunucusu

**Eklenmedi:** `location`, `fetch`, `processing`, push (`aps-environment`), App Groups (WatchConnectivity mevcut akışta zorunlu değil).

Kaynak: `SOSMesh/Info.plist`, `CoreBLE/BleBackgroundConfiguration.swift`.

### iOS arka plan sınırları — sürüm notu taslağı (TR/EN)

**TR (App Store “What’s New” / internal release notes):**

> iOS, uygulama arka planda veya zorla kapatıldığında Bluetooth mesh relay’i sınırlayabilir veya durdurabilir. SOSMesh acil çağrı (112) yerine geçmez. Peer “alındı” bildirimi operatör müdahalesi veya kurtarma anlamına gelmez.

**EN:**

> iOS may suspend or stop Bluetooth mesh relay in background or after force quit. SOSMesh is not a replacement for emergency services (112). Peer received does not mean operator response or rescue.

Matris: `docs/compat/ios-background-matrix.csv` — tüm fiziksel satırlar **NOT_TESTED**.

## macOS’ta archive (kullanıcı — hazır, uygulanmadı)

```bash
cd apps/ios
export SOSMESH_RELEASE_FLAVOR=prod   # demo | staging | prod
export SOSMESH_APPLE_TEAM_ID=XXXXXXXXXX
export SOSMESH_CODE_SIGN_IDENTITY="Apple Distribution"
export SOSMESH_IOS_PROFILE_NAME="SOSMesh iOS Distribution"
export SOSMESH_WATCH_PROFILE_NAME="SOSMesh Watch Distribution"
export SOSMESH_WIDGET_PROFILE_NAME="SOSMesh Watch Widgets Distribution"
./scripts/archive-export.sh
```

Çıktı: `build/SOSMesh-<flavor>.xcarchive`, `build/export-<flavor>/`. TestFlight’a yükleme: **BLOCKED_APPROVAL** — onay sonrası Transporter veya `xcrun altool` (anahtarlar repoda yok).

## Fiziksel test planı

### iPhone ↔ Android yaşam döngüsü

Prosedür özeti (detay: `docs/tests/cross-platform-integration-report.md`, `docs/compat/cross-platform-matrix.csv`):

1. Foreground iPhone → Android SOS (fixture veya sentetik metin; **gerçek GPS/PII loglanmaz**).
2. Android → iPhone ters yön.
3. BT kapat/aç, uygulama arka plan/kilit — durum satırları **PEER_RECEIVED** yalnız doğrulanmış ack sonrası.
4. API yükleme hatasında cihazda yeşil “ekibe ulaştı” yok (`CrossPlatformFaultViews`).

### Eşli Apple Watch SOS

1. Eşleşmiş iPhone + Watch; watch’tan iki adımlı SOS.
2. iPhone outbox’ta `origin=watch_os`, tek `messageId`.
3. Telefon erişilemez: saat **beklemede** — sahte başarı yok (`docs/watches/capability-matrix.md`).

### Arka plan aktarım

1. WCSession: telefon kilitli / uygulama arka planda SOS from watch.
2. BLE relay: matris satırı BG-02 — sonuç **NOT_TESTED** until video trace.

### VoiceOver

Script: Ana Sayfa SOS, Status timeline, Relay uyarıları, Settings sınırlar — her kontrol için `accessibilityLabel` duyulmalı; fiziksel sonuç **NOT_TESTED**.

### Pil / izin saha matrisi

| Koşul | Bluetooth | Konum | Relay opt-in | Beklenen UX | Sonuç |
|--------|-----------|--------|--------------|-------------|--------|
| Normal | On | WhenInUse optional | Off | SOS kuyruk | NOT_TESTED |
| Konum reddi | On | Denied | Off | Akış devam, unknown konum | NOT_TESTED |
| Düşük güç | On | Any | On | Sınırlı relay kopyası | NOT_TESTED |
| BT kapalı | Off | Any | Any | Self-repair banner | NOT_TESTED |

Kanıt şablonu: `docs/release/evidence/ios-field-test-record-template.csv` — **tüm `result` sütunları NOT_TESTED** (PASS uydurulmaz).

## App Review metadata taslakları

### Türkçe — App Store Connect

| Alan | Taslak |
|------|--------|
| Ad | SOSMesh |
| Alt başlık | Acil durum mesh (deneysel) |
| Açıklama | SOSMesh, internet kesintilerinde yakındaki cihazlar üzerinden şifreli SOS iletimi dener. Resmî acil numara (112) yerine geçmez. Operatör paneli ve AI yalnızca backend erişimi olan senaryolarda devreye girer; cihaz peer ACK’si kurtarma garantisi değildir. |
| Anahtar kelimeler | acil, afet, bluetooth, mesh, offline |
| Destek URL | (kullanıcı onayıyla) |
| Gizlilik politikası URL | `docs/legal/privacy-policy-draft.md` — yayın URL’si BLOCKED_APPROVAL |

### English — App Store Connect

| Field | Draft |
|-------|--------|
| Name | SOSMesh |
| Subtitle | Emergency mesh (experimental) |
| Description | SOSMesh attempts encrypted SOS delivery via nearby devices when the internet fails. Not a replacement for emergency services. Peer ACK is not operator response. AI triage requires backend; it does not autonomously dispatch rescue. |
| Keywords | emergency, disaster, bluetooth, mesh, offline |

**Review notes (TR/EN):** Demo hesap yok; fiziksel BLE lab video eklenecek (NOT_TESTED). Watch companion requires paired iPhone.

## TestFlight

| Adım | Durum |
|------|--------|
| Archive + export script | Hazır |
| IPA yükleme | **BLOCKED_APPROVAL** |
| Internal tester daveti | **BLOCKED_APPROVAL** |
| Kurulum kanıtı ekran görüntüsü | **NOT_TESTED** |

## Kullanıcı onayı gereken eylemler

1. Apple Developer Program / Team ID ve dağıtım sertifikaları (repoya yazılmaz).
2. App Store Connect uygulama kaydı + bundle ID’ler (`Release-Prod.xcconfig` ile uyumlu).
3. Provisioning profile adlarının `ExportOptions.template.plist` yer tutucularına eşlenmesi; bundle ID'ler `Release-*.xcconfig` ile `archive-export.sh` tarafından otomatik doldurulur (`__SOSMESH_BUNDLE_ID_*__`).
4. `./scripts/archive-export.sh` çalıştırması (MacBook).
5. TestFlight yükleme ve internal test (BLOCKED_APPROVAL → onay sonrası).
6. Fiziksel test matrisinin doldurulması; kanıt video/log (PII/GPS ham verisi repoya **konmaz**).
7. App Store metadata URL’leri (destek, gizlilik) yayın onayı.

## Doğrulama kanıtı (ADIM 52)

| Beklenen | Bu teslim |
|----------|-----------|
| TestFlight proof veya BLOCKED_APPROVAL | **BLOCKED_APPROVAL** |
| Hardware BLE video | **NOT_TESTED** |
| GEÇTİ: gerçek cihaz iş akışı kanıtlı | **Hayır** → adım **PARTIAL** |

CI: GitHub `iOS Xcode Build` job (simulator, `CODE_SIGNING_ALLOWED=NO`) — archive’ın yerine geçmez.
