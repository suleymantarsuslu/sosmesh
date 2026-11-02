# Wear OS — Play release kapısı (ADIM 53)

Bu belge **kod/yapılandırma hazırlığıdır**. Google Play başvurusu, gerçek imzalama anahtarı kullanımı ve kademeli prod yayını **BLOCKED_APPROVAL** — kullanıcı onayı olmadan uygulanmaz.

## Modül ve artifact

| Öğe | Değer |
|-----|--------|
| Gradle modül | `apps/android/wear` (`:wear`) |
| `applicationId` | `com.sosmesh.android.wear` |
| Companion çekirdek | `apps/android/core/wear-companion` |
| Release AAB görevi | `bash scripts/wear-release-bundle.sh` → `:wear:bundleRelease` |
| İmza (yalnız adlar) | `SOSMESH_WEAR_RELEASE_STORE_FILE`, `SOSMESH_WEAR_RELEASE_STORE_PASSWORD`, `SOSMESH_WEAR_RELEASE_KEY_ALIAS`, `SOSMESH_WEAR_RELEASE_KEY_PASSWORD` (env veya Gradle property; **repoya yazılmaz**) |
| İmza yoksa | İmzasız release AAB (Play upload anahtarı: **BLOCKED_APPROVAL**) |

## Manifest ve izin gözden geçirmesi

Dosya: `apps/android/wear/src/main/AndroidManifest.xml`

| Kontrol | Beklenen | Gerekçe |
|---------|----------|---------|
| `android.hardware.type.watch` | Var | Wear-only APK |
| `com.google.android.wearable.standalone` | **`false`** | SOSMesh saat **companion**; telefon uygulaması olmadan mesh/sunucu yolu yok |
| `com.google.android.wearable` library | `required=true` | Wear OS platform |
| İzinler | `WAKE_LOCK`, `VIBRATE` | Konum/BLE/INTERNET **yok** (telefonda) |
| Data Layer ACK servisi | `WearPhoneAckListenerService` exported | Telefon → saat ACK yolu |

Otomatik kapı: `WearManifestReleaseGateTest` (Robolectric).

### Tile / complication yüzeyleri

| Yüzey | Durum | Not |
|-------|--------|-----|
| Launcher + iki adımlı SOS | **Destekleniyor** | ADIM 35–36 |
| Tile | **Yok (bilinçli erteleme)** | Yanlışlıkla tek dokunuş SOS riski |
| Complication / watch face | **Yok** | watchOS complication kopyası ile hizalı politika: `docs/watches/wear-policy.md` |

## Kullanıcı senaryoları

### Eşli telefon (happy path)

1. Saat + eşleşmiş Android telefon (Data Layer, capability `sosmesh_phone_v1`).
2. Saat: bas → bırak → **Gönder** onayı.
3. Telefon: `PhoneWearCompanionListenerService` → Room outbox `origin=wear_os`.
4. Saat UI: yalnızca telefon ACK ile **«Telefona kaydedildi»** — sunucu/operatör iddiası **yok**.

**Fiziksel kanıt:** **NOT_TESTED** (MacBook + gerçek saat aşaması).

### Telefonsuz / telefon erişilemez (negative)

- Saat mesajı yerelde tutar; UI: **«Telefona ulaşılamıyor»** — **«gönderildi» denmez**.
- JVM: `WearSosViewModelPhoneUnreachableTest`, `WearOfflineQueueTest`, `WearStateSyncEngineCopyTest`.

**Fiziksel kanıt (telefon kapalı / menzil dışı):** **NOT_TESTED**.

### Yeniden deneme

- Kuyruk: `WearRetryPolicy` (5s → 15s → 60s → 5dk) — `docs/watches/wear-policy.md`.
- Pil tasarrufu: `WearPowerRetryPolicy` gecikmeyi 2× uzatır; kullanıcıya «Pil tasarrufu açık…» detayı (birim test: `WearPowerRetryPolicyTest`).

**Fiziksel pil tasarrufu + ambient:** **NOT_TESTED**.

## Ambient / always-on ve görsel inceleme

| Konu | Kod | Otomatik test | Fiziksel |
|------|-----|---------------|----------|
| Ambient mod (burn-in güvenli) | `WearMainActivity` + `AmbientModeSupport`, `WearAmbientUiPolicy` | `WearRootScreenAmbientRobolectricTest` | NOT_TESTED |
| Yuvarlak ekran kırpılma | Compose padding 8dp, round qualifier | `WearRootScreenRoundRobolectricTest` | NOT_TESTED |
| Büyük yazı tipi (fontScale 2) | Wear Material typography | `WearRootScreenLargeFontRobolectricTest` | NOT_TESTED |

Script: `bash scripts/wear-unit-tests.sh` (ANDROID_HOME yoksa logda NOT_TESTED yazar, exit 0).

## Gerçek saat → telefon outbox → gateway iz kanıt şablonu

Dosya: `docs/handover/evidence/adim53/trace-evidence-template.md`

Doldurulunca **PASS uydurulmaz**; boş alanlar **NOT_TESTED** kalır.

## Play Console metadata taslağı (BLOCKED_APPROVAL)

| Alan | Taslak |
|------|--------|
| Uygulama adı | SOSMesh (Wear) |
| Kısa açıklama | Eşleşmiş telefona acil SOS ileten Wear companion; 112 yerine geçmez. |
| Tam açıklama | Acil durumda iki adımlı onaylı SOS. Telefon kuyruğuna aktarım; bağımsız mesh rölesi yok. |
| Kategori | Health & fitness veya Tools (ürün sahibi onayı) |
| Gizlilik politikası URL | `docs/legal/privacy-policy-draft.md` → yayın URL’si **BLOCKED_APPROVAL** |
| Veri güvenliği formu | Konum/sağlık **saatten toplanmaz**; SOS payload telefonda işlenir |
| Wear özelliği | Companion (standalone=false) |
| Ekran görüntüleri | Yuvarlak + dikdörtgen — **NOT_TESTED** (cihazdan export) |

## Gizlilik beyanı özeti

- Saat **PII/GPS toplamaz**; yalnızca SOS wire JSON’u telefona iletir.
- Röle/sunucu metni saatte görünmez.
- Peer ACK ≠ operatör okundu.

## Kademeli yayın planı taslağı (BLOCKED_APPROVAL)

1. **Internal testing** — geliştirici + 5 gönüllü (test kimlikleri, sentetik olay).
2. **Closed testing** — pilot kullanıcı listesi (ADIM 55 ile hizalı).
3. **Production** — %5 → %20 → %100; geri alma: önceki sürüm AAB.

Tüm Play track yüklemeleri: **hazır, uygulanmadı (BLOCKED_APPROVAL)**.

## Doğrulama özeti (bu PR)

| Kapı | Sonuç |
|------|--------|
| Manifest companion / izin | JVM test |
| Telefonsuz kullanıcı mesajı | JVM test |
| AAB packaging script | Hazır; imza env yok → BLOCKED_APPROVAL |
| Gerçek saat uçtan uca | **NOT_TESTED** (GEÇTİ ölçütü karşılanmadı) |
| Play yayını | **BLOCKED_APPROVAL** |

## İlgili dosyalar

- `apps/android/wear/build.gradle.kts` — release + imza property adları
- `scripts/wear-release-bundle.sh`, `scripts/wear-unit-tests.sh`
- `docs/watches/wear-policy.md`
- `docs/handover/status.json` — ADIM 53 `PARTIAL`
