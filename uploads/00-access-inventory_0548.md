# SOSMesh — Erişim Envanteri (ADIM 01, salt-okunur)

- Tarih: 2026-10-29 (Europe/Istanbul, UTC+3)
- Kural: Hiçbir şey kurulmadı/değiştirilmedi/klonlanmadı/push edilmedi. Sır DEĞERİ hiçbir yerde yok; yalnız var/yok.
- Ham kanıtlar: `docs/evidence/box-inventory.txt`, `docs/evidence/user-mac-inventory.txt`

## 1. Özet tablo

| Alan | Durum | Kanıt / bağlantı tipi |
|---|---|---|
| Kutu (Linux) Node/pnpm/npm/git/gh/python3 | VAR | Shell (box) — `node --version` vb. |
| Kutu JDK/Gradle/Kotlin/Swift/Xcode/adb/Android SDK/Docker | **YOK** | Shell (box) — `command -v` boş |
| Kutu `gh` oturumu | **YOK** (giriş yapılmamış) | `gh auth status` |
| GitHub (MCP `cursor-github`) | VAR, kullanıcı `suleymantarsuslu` | `get_me`, `search_repositories` (salt-okunur) |
| SOSMesh/sos/mesh GitHub reposu | **YOK** | arama sonuçları (aşağıda) |
| Cursor Origin (MCP `cursor-origin`) | Bağlı, **namespace listesi boş** | `list_namespaces` → `{"namespaces":[]}` |
| Kullanıcı Mac (MacBook Pro) | ÇEVRİMİÇİ, Shell erişimi çalıştı | `ListMachines` + Shell(machineId) |
| Kullanıcı iPhone 13 Pro Max (kayıtlı makine) | **ÇEVRİMDIŞI** (connected=false) | `ListMachines` |
| Mac: Xcode | VAR 27.1 | `xcodebuild -version` |
| Mac: Android Studio | **YOK** (Android SDK komut satırı araçları VAR) | `/Applications/Android Studio.app` yok |
| Mac: bağlı fiziksel cihaz | **YOK** (adb boş; iPhone'lar OFFLINE) | `adb devices -l`, `xctrace list devices` |
| Meta anahtarı (kutu env) | **KISMEN**: `META_APP_ID`, `META_APP_SECRET` isimleri var; `MODEL_API_KEY`/`META_MODEL*` yok | `env` isimleri (değer okunmadı) |
| Meta anahtarı (Mac env) | YOK | env isimleri |
| Cursor CLI / cursor-agent | Kutu: YOK; Mac: PATH'te YOK, `Cursor.app` VAR | `command -v` / `ls /Applications` |
| Bütçe/harcama limiti | **BİLİNMİYOR** | kayıt bulunamadı → kullanıcı onayı gerekir |

## 2. Kutu (Linux) — `docs/evidence/box-inventory.txt`

OS: Debian GNU/Linux 13 (trixie), kernel 6.12.94, x86_64 (`uname -a`, `/etc/os-release`).

| Araç | Durum | Çıktı | Kaynak komut |
|---|---|---|---|
| node | VAR | v20.19.2 | `node --version` |
| pnpm | VAR | 10.34.6 | `pnpm --version` |
| npm | VAR | 11.21.1 | `npm --version` |
| git | VAR | 2.47.3 | `git --version` |
| gh | VAR (oturum yok) | 2.103.0 | `gh --version`; `gh auth status` → giriş yok |
| python3 | VAR | 3.13.5 | `python3 --version` |
| java / javac | yok | — | `command -v java` |
| gradle | yok | — | |
| docker | yok | — | |
| kotlin / kotlinc | yok | — | |
| swift | yok | — | |
| xcodebuild | yok (Linux) | — | |
| adb / sdkmanager | yok | — | |
| Android SDK (ANDROID_*, ~/Android, /opt/android*) | yok | — | |
| cursor / cursor-agent | yok | — | |

Meta/LLAMA ortam değişken İSİMLERİ (değer okunmadı): `META_APP_ID`, `META_APP_SECRET`. 
Not: Bunlar Meta uygulama kimlik bilgisi adlarıdır; master planın `MODEL_API_KEY` (Meta Model API, server-only) anahtarı olduğu **doğrulanmadı**. Anahtarın geçerliliği/kotası test edilmedi.

## 3. GitHub (cursor-github MCP) — salt-okunur

- Kimliği doğrulanmış hesap: `suleymantarsuslu` (id 32713624), 70 repo, hepsinde admin/push.
- `sosmesh in:name,description` → 0 sonuç; `mesh in:name` → 0 sonuç; `sos in:name` → 1 sonuç: `suleymantarsuslu/edavam_sosyal` (**ilgisiz**, "sosyal" kelimesi; özel repo).
- SOSMesh için hazır repo **yok** → D-001 (yeni monorepo) uygulanabilir; repo oluşturma kullanıcı onayı ister (BLOCKED_APPROVAL adayı).
- Önceki projeler (ör. DRONIX, VARIS, PetCam, Balon-Oyunu — Kotlin; edavam_*, antiosoft vb.) bulundu; **kod devşirilmeyecek** (D-001).
- Not: Mac'teki `gh` ve kutudaki `gh` giriş yapmamış; git push/clone için MCP veya Cursor Cloud Agent kullanılmalı.

## 4. Cursor Origin (cursor-origin MCP)

- `list_namespaces` → boş. Origin'de okunabilir repo yok; SOSMesh ile ilgili repo yok. Origin repo oluşturma (`create_repository`) onay gerektirir ve yapılmadı.

## 5. Kullanıcı bilgisayarları (`ListMachines`)

| Makine | Tür | Durum |
|---|---|---|
| SULEYMAN-MacBook-Pro-2.local (64656c0b-…) | desktop | connected=true |
| iPhone 13 Pro Max (3509cd29-…) | ios | connected=false |

Mac sonuçları (`docs/evidence/user-mac-inventory.txt`; kaynak: Shell machineId ile):
- macOS 26.6.2 arm64; Xcode 27.1 (27A9275); Swift 6.4; xcode-select → /Applications/Xcode.app
- node v24.16.0, pnpm 10.18.1, npm 11.13.0, git 2.54.0, gh 2.101.0 (giriş yok), python3 3.14.6
- JDK: PATH'teki java **11.0.31** (Temurin); ayrıca Temurin **26.0.1** ve 11 kurulu (`java_home -V`). `/usr/bin/java -version` → 11.0.31 iken `java_home` varsayılanı 26.0.1 gösterdi (tutarsız; JAVA_HOME ayarı incelenmedi). Android Gradle Plugin için JDK 17 toolchain ADIM 12'de netleştirilmeli.
- Gradle: yok (PATH) — wrapper kullanılacak. Kotlin derleyici yok (Gradle ile gelir).
- Docker CLI 29.7.2 var; **daemon çalışmıyor** (docker.sock yok).
- Android Studio: yok. Android SDK: `~/Library/Android/sdk` (platforms android-35/36, build-tools 34/35/36, cmdline-tools, emulator, ndk, platform-tools). adb PATH'te değil (tam yol ile 1.0.41 / 37.0.0).
- `adb devices -l`: boş → bağlı Android cihaz yok. AVD: `Yatirim_API_35` (emülatör; fiziksel BLE kanıtlamaz).
- `xcrun xctrace list devices`: 2 iPhone OFFLINE (iOS 26.6.1, 27.2); simülatörler iOS 26.5/27.0. Apple Watch çifti/simülatörü doğrulanmadı.
- Cursor: `Cursor.app` mevcut, `cursor`/`cursor-agent` komutu PATH'te yok.
- Meta/LLAMA env: yok. `sosmesh|mesh|sos` klasörü yaygın dizinlerde (ilk seviye) yok.
- `xcrun simctl list runtimes` 60 sn'de dönmedi; bu komutun çıktısı toplanamadı (NOT_TESTED).

## 6. Grok → Cursor yolu

**Grok tarafından doğrulandı (2026-10-29, UTC+3):** Grok, Cursor Cloud Agent API'sine birinci taraf araçla erişiyor. Gerçek çağrılar: `repositories` (bağlı sağlayıcı: github, `suleymantarsuslu`), `workers` (4 private worker, hepsi "SULEYMAN MacBook Pro" üzerinde: ANTIOSOFT-HQ, antiosoft, DRONIX, ANTIOSOFT-DevCloud workspace'leri; SOSMesh için ayrılmış worker yok), `list` (4 mevcut Project, hepsi finished). Launch/reply/rapor okuma yolu, ADIM 01 commit görevinin kendisiyle doğrulanır (aşağıda commit SHA). Sonuç: otomatik Grok→Cursor döngüsü mevcut; manuel copy-paste gerekmiyor. Mac'te `cursor`/`cursor-agent` CLI yok; yerel Cursor CLI yolu kullanılmıyor. iOS/macOS derleme için ileride SOSMesh workspace'li ayrı bir private worker gerekecek (B-13).

Önceki keşifte kanıtlananlar:
- Kutuda/Mac'te `cursor-agent` CLI yok; Mac'te `Cursor.app` var.
- cursor-github MCP: repo okuma/PR/issue araçları var (yazma araçları da var — onaysız kullanılmadı).
- cursor-origin MCP: salt-okunur/PR araçları var; namespace boş.
- Cursor cloud agent başlatma/yanıt/rapor okuma yolunun varlığı bu keşifte test EDİLMEDİ ve "var" diye işaretlenmedi.

## 7. Missing capability raporu (kısa)

1. SOSMesh repo yok (GitHub/Origin) → oluşturma onayı + görünürlük kararı.
2. Gerçek BLE testi için: bağlı fiziksel Android ×2 (yok), iOS cihazlar OFFLINE, Wear OS/Apple Watch yok.
3. Android Studio yok; JDK sürüm uyumu ve Gradle wrapper ADIM 12'de.
4. Docker daemon kapalı (ADIM 05 Compose için başlatılmalı; kurulum/başlatma kullanıcı kararı).
5. Meta Model API anahtarı (`MODEL_API_KEY`) doğrulanmadı; yalnız `META_APP_ID/SECRET` adları var.
6. Apple/Google geliştirici hesapları, imzalama, mağaza erişimi: doğrulanmadı (BLOCKED_APPROVAL).
7. Bütçe limiti bilinmiyor.
8. Kutuda JDK/Android SDK/Docker/Xcode yok → Android/iOS derleme ve Compose testleri Cursor cloud agent ortamında veya kullanıcının Mac'inde yapılmalı.
