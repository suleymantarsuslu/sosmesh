# Android yayın kapısı (ADIM 51)

**Amaç:** `apps/android` için teslim edilebilir release artifact’ları, imzalama sözleşmesi, R8/mapping, yerel crash kaydı ve gerçek cihaz smoke planı — **mağaza yayını bu adımda yapılmaz**.

| Bileşen | Durum |
| --- | --- |
| Product flavor `demo` / `staging` / `prod` | Hazır |
| Release R8 + ProGuard + mapping çıktısı | Hazır |
| APK/AAB Gradle görevleri | Hazır |
| Env/property ile imzalama | Hazır (keystore repoda yok) |
| BuildConfig secret taraması | CI + unit test |
| Yerel PII’siz crash log | Hazır (harici SDK yok) |
| Play Data safety / izin taslağı | `play-console-declarations-draft.md` |
| Gerçek cihaz smoke kanıtı | **NOT_TESTED** |
| Play Internal Test yükleme | **BLOCKED_APPROVAL** |

## Product flavor’lar

| Flavor | applicationId | INGEST tabanı (BuildConfig) | DEMO etiketi |
| --- | --- | --- | --- |
| demo | `com.sosmesh.android.demo` | `https://api.demo.sosmesh.local` | Açık (release dahil) |
| staging | `…android.staging` | `https://sosmesh.antiosoft.com` (VULUT Coolify) | Kapalı |
| prod (varsayılan) | `com.sosmesh.android` | `https://sosmesh.antiosoft.com` (VULUT Coolify) | Kapalı |

Receipt doğrulama public key hâlâ boş placeholder — production dağıtım **BLOCKED_APPROVAL** (`RelayIngestConfig.PROD_RECEIPT_PUBLIC_KEY_PLACEHOLDER`).

Kaynak: `apps/android/app/build.gradle.kts`

## İmzalama (keystore repoda yok)

Yalnızca **ortam değişkeni** veya **Gradle property adları** (değer repoya yazılmaz):

| Ad | Açıklama |
| --- | --- |
| `SOSMESH_RELEASE_STORE_FILE` / `sosmesh.release.storeFile` | Keystore dosya yolu (CI secret veya yerel) |
| `SOSMESH_RELEASE_STORE_PASSWORD` / `sosmesh.release.storePassword` | Store parolası |
| `SOSMESH_RELEASE_KEY_ALIAS` / `sosmesh.release.keyAlias` | Key alias |
| `SOSMESH_RELEASE_KEY_PASSWORD` / `sosmesh.release.keyPassword` | Key parolası |

Tanımlı değilse release derlemesi **debug imzası** ile üretilir (yerel smoke / CI); Play production imzası **BLOCKED_APPROVAL**.

Örnek (yalnızca yerel shell — repoya kaydetmeyin):

```bash
export SOSMESH_RELEASE_STORE_FILE="$HOME/keystores/sosmesh-upload.jks"
export SOSMESH_RELEASE_STORE_PASSWORD=<store-password>
export SOSMESH_RELEASE_KEY_ALIAS='upload'
export SOSMESH_RELEASE_KEY_PASSWORD=<key-password>
cd apps/android && ./gradlew bundleProdRelease
```

## Derleme görevleri

```bash
cd apps/android
./gradlew assembleProdDebug testProdDebugUnitTest lintProdDebug ktlintCheck
./gradlew releaseProdArtifacts          # assembleProdRelease + bundleProdRelease
./gradlew assembleAllReleaseApks        # demo + staging + prod APK
./gradlew bundleAllReleaseAabs
```

### Artifact yolları

| Artifact | Yol |
| --- | --- |
| Prod release APK | `app/build/outputs/apk/prod/release/app-prod-release.apk` |
| Prod release AAB | `app/build/outputs/bundle/prodRelease/app-prod-release.aab` |
| R8 mapping | `app/build/outputs/mapping/prodRelease/mapping.txt` |

Hash örneği: `sha256sum app/build/outputs/apk/prod/release/app-prod-release.apk`

## Sürüm notu şablonu

```markdown
## SOSMesh Android <versionName> (<versionCode>) — prod

### Yenilikler
- …

### Düzeltmeler
- …

### Bilinen sınırlamalar
- Resmî acil (112) servisinin yerine geçmez.
- Offline mesh peer ACK ≠ operatör/kurtarma onayı.
- Röle ciphertext dışında SOS metnini okumaz.

### Desteklenen cihazlar
- minSdk 26, BLE LE zorunlu (manifest `uses-feature`)

### Rollback
- Önceki APK/AAB hash: …
- Play Console → sürüm geri al / önceki artifact (BLOCKED_APPROVAL)
```

## Kurulum ve rollback (sideload / internal track)

1. **Yedek:** Mevcut yüklü sürümün `versionName` ve APK hash’ini kaydedin.  
2. **Yükleme (adb):** `adb install -r app-prod-release.apk` — imza uyuşmazlığında önce kaldırın (veri kaybı uyarısı Settings metninde).  
3. **Rollback:** Önceki imzalı APK/AAB’yi tekrar yükleyin veya Play’de önceki release’e dönün (**BLOCKED_APPROVAL**).  
4. **Doğrulama:** Uygulama açılış → izin ekranı → SOS offline kuyruk (M0) smoke maddeleri.

## Gerçek cihaz smoke planı (2 cihaz + BLE)

**Sonuç şablonu:** `docs/release/evidence/android-device-smoke-template.md`  
**Toplama script:** `scripts/android-device-release-smoke-adim51.sh` (adb yoksa exit 2, **NOT_TESTED**)

| ID | Adım | Beklenen |
| --- | --- | --- |
| S1 | A ve B: BLE keşif, GATT | Peer görünür; sahte “ekibe ulaştı” yok |
| S2 | Konum/BT izni reddi, BT kapat | Akış durur veya offline rozet; yanlış yeşil yok |
| S3 | Doze / pil tasarrufu | Röle duraklatma / platform ipuçları (`MeshPlatformStateMachine`) |
| S4 | 24 saat reconnect (veya hızlandırılmış test) | Outbox korunur; reconnect sonrası upload denemesi |
| S5 | M0+M1 uç akış | PEER_RECEIVED yalnız doğrulanmış peer ACK ile |

Tüm maddeler Cloud Agent’ta **NOT_TESTED** — kanıt kullanıcı MacBook + fiziksel cihazda doldurulacak.

## Crash log altyapısı

- Sınıf: `RedactedLocalCrashReporter` — yalnız uygulama-private `filesDir/sosmesh-crash/*.json`
- PII redaksiyon: `CrashLogRedactor` (e-posta, telefon benzeri, koordinat)
- Harici Firebase/Crashlytics **yok**

## Doğrulama (repo)

| Kontrol | Komut |
| --- | --- |
| BuildConfig secret scan | `bash scripts/android-release-buildconfig-scan.sh` |
| Dev crypto release dışı | `bash scripts/android-release-no-dev-crypto.sh` |
| Unit (prod debug) | `cd apps/android && ./gradlew :app:testProdDebugUnitTest` |

## Kullanıcı onayı gereken eylemler

1. Upload keystore oluşturma / Play App Signing (**BLOCKED_APPROVAL**)  
2. Production API host + ingest receipt public key BuildConfig/remote config (**BLOCKED_APPROVAL**)  
3. Play Console Data safety + izin beyanı gönderimi (**BLOCKED_APPROVAL**)  
4. Internal / production track yükleme (**BLOCKED_APPROVAL**)  
5. Gerçek cihaz smoke kanıtını şablona işleme (**NOT_TESTED**)

## GEÇTİ ölçütü (master plan)

> APK gerçek cihazda M0+M1 akışını çalıştırır; store acceptance ayrı gate.

**Mevcut durum:** **PARTIAL** — yapılandırma ve artifact görevleri hazır; fiziksel kanıt ve mağaza adımları tamamlanmadı.
