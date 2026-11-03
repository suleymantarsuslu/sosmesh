# CI runner notları

## Genel

Linux CI job’ları varsayılan olarak GitHub-hosted `ubuntu-latest` üzerinde koşar (private repo **Actions dakika kotası**). iOS job’u varsayılan modda GitHub-hosted `macos-latest` üzerinde koşar (Zulal modunda **atlanır**; Mac runner kapalıyken aşağıya bakın).

## MacBook self-hosted mobile CI (`vars.SOSMESH_MAC_RUNNER`)

Koordinatör repo değişkenini **`SOSMESH_MAC_RUNNER=on`** yaptığında şu job’lar tek fiziksel runner’da (`macbook-sosmesh`, etiketler: `self-hosted`, `macOS`, `ARM64`, `macbook`, `sosmesh-mac`) koşar:

- `swift-package-tests`
- `android-gradle` (Android projesi algılandığında)
- `ios-xcode` (iOS projesi algılandığında)

**Kapalıyken** (`on` değilken) davranış önceki gibi kalır: Zulal modunda bu üç job atlanır ve `Mobile verification deferred (MacBook phase)` job’u NOT_TESTED yazar; Zulal kapalıyken Android/Swift GitHub `ubuntu-latest`, iOS `macos-latest` kullanır.

### Mac runner’da kurulum yok

- **Xcode / Swift:** `setup-xcode` ve `setup-swift` çalışmaz; job başında `xcodebuild -version` ve `swift --version` yazdırılır (runner’daki Xcode 27.x / Swift 6.x).
- **Java / Android:** Runner’ın `JAVA_HOME` (Temurin **17**) ve `ANDROID_HOME` / `ANDROID_SDK_ROOT` kullanılır; `setup-java` 21 **Mac yolunda** yok. `platforms;android-35` ve `build-tools;35.0.0` dizinleri yoksa job **sdkmanager çalıştırmadan** açık hata ile düşer.
- **İzolasyon:** Gradle `GRADLE_USER_HOME=${{ runner.temp }}/gradle-<job>`; Gradle `--no-daemon`. Kalıcı home dizinine cache yazılmaz (runner work dir dışında).
- **Eşzamanlılık:** Mobile job `concurrency` grupları `github.sha` ile anahtarlanır (aynı commit yeniden koşunca iptal). Yeni push eski workflow’u GitHub iptal eder; tek MacBook’ta Android → iOS sırası `needs` ile korunur.

### Özet job’u

`SOSMESH_MAC_RUNNER=on` iken `Mobile verification deferred (MacBook phase)` job’u mobile job sonuçlarını `$GITHUB_STEP_SUMMARY` içine yazar ve beklenen bir mobile job başarısız/iptal olursa **fail** eder. Zulal + Mac açıkken Linux’ta hâlâ NOT_TESTED kalan kontroller (compose smoke, Firefox/WebKit axe) ayrı satırlarda kalır.

### Manuel doğrulama (CI dışı)

Fiziksel cihaz, gerçek BLE taraması/eşleşmesi ve App Store imzalama **CI’da koşmaz**; Mac runner yalnızca derleme, simulator unit testleri ve SwiftPM testlerini kapsar. Donanım/BLE senaryoları yerelde veya koordinatör onaylı manuel checklist ile yapılır.

**Geri almak:** `SOSMESH_MAC_RUNNER` değişkenini silmek veya `on` dışı bir değere çevirmek yeterli.

## Geçici Zulal fallback (`vars.SOSMESH_CI_RUNNER`)

GitHub Actions faturalama / kota sorunlarında koordinatör repo değişkenini `SOSMESH_CI_RUNNER=zulal` yapabilir. Bu durumda aşağıdaki Linux job’lar Zulal self-hosted runner’da koşar (`[self-hosted, linux, ARM64, zulal]`; `verify` ek olarak `zulal-verify`):

- `verify`
- `contracts`
- `detect-mobile`
- `cross-language-contracts`
- `secret-scan`
- `load-smoke` (k6 profil 100)

**Geri almak:** değişkeni silmek veya `zulal` dışı bir değere çevirmek yeterli; workflow tekrar `ubuntu-latest` / `macos-latest` kullanır ve aşağıdaki NOT_TESTED job’ları yeniden etkinleşir.

### Zulal’da bilinçli olarak NOT_TESTED (skipped)

| Job / kontrol | Neden |
|---------------|--------|
| Android Gradle Build | Android SDK yok; MacBook fazında |
| iOS Xcode Build | Xcode yok; MacBook fazında |
| Swift Package Tests | Swift toolchain yok; MacBook fazında |
| Build images and staging compose smoke | `ghrunner` Docker erişimi yok (ayrı onay gerekir) |

PR’larda `Mobile verification deferred (MacBook phase)` job’u **Zulal modunda ve Mac runner kapalıyken** koşar ve `$GITHUB_STEP_SUMMARY` içine NOT_TESTED satırlarını yazar (sahte PASS yok). Mac runner `on` iken aynı job gerçek mobile sonuçlarını özetler.

## Verify Quality Gates (`verify` job)

- **Runner:** `ubuntu-latest`, veya `SOSMESH_CI_RUNNER=zulal` iken `[self-hosted, linux, ARM64, zulal, zulal-verify]`.
- **PostgreSQL (hosted):** Job `services: postgres` (`postgres:16`; yalnızca CI test parolası). Job `env` ile `SOSMESH_CI_*_URL` tanımlıdır.
- **PostgreSQL (Zulal):** Service container kullanılmaz; `Load CI PostgreSQL credentials` adımı `/etc/sosmesh-ci/pg.env` dosyasını yükler (`::add-mask::` ile).
- **Playwright:** Hosted modda `npx playwright install --with-deps chromium firefox webkit`; Zulal modda `npx playwright install chromium firefox webkit` (sudo yok). Zulal’da Firefox/WebKit axe projeleri koşulmaz (sistem kütüphaneleri `install-deps` sudo gerektirir); chromium + `-linux-arm64` snapshot yolu kullanılır.
- **ARM64 görsel regresyon (ADIM 50 reduced-motion):** Beklenen PNG’ler repoda sabitlenmiştir: `tests/ux/adim50-web-closure.spec.js-snapshots/adim50-{login,dashboard}-reduced-motion-chromium-linux-arm64.png`. CI bu dosyalar yoksa veya piksel farkı `maxDiffPixelRatio: 0.02` eşiğini aşarsa **başarısız olur**; koşu sırasında `--update-snapshots` çalıştırılmaz. Yenileme yalnızca bilinçli, incelenmiş manuel adımla: Zulal veya eşdeğer ARM64 Linux ortamında `SOSMESH_CI_RUNNER=zulal pnpm exec playwright test --config=playwright.web.config.js --project=chromium --grep "prefers-reduced-motion" --update-snapshots`, diff’leri gözden geçirip PNG’leri commit. Verify job, Zulal’da snapshot hatasında `test-results/**/*-{actual,diff}.png` artifact yükler (hata ayıklama).
- Zulal modunda `verify`, port 3000/3001 çakışmasını önlemek için `zulal-verify` etiketli tek runner'da sırayla koşar.

## Load smoke (`load-smoke` job)

- **Runner:** aynı `runs-on` ifadesi (`ubuntu-latest` ↔ Zulal).
- **PostgreSQL (hosted):** `services: postgres:16` + job `env` (`SOSMESH_CI_PG_ADMIN_URL` / `SOSMESH_CI_DATABASE_URL`).
- **PostgreSQL (Zulal):** Service yok; `Load CI PostgreSQL credentials` + `tests/load/ci-k6-smoke.sh` koşu başına izole DB (`smoke-ci-db.mjs`, iki runner çakışmasın diye).
- **k6:** Hosted `ubuntu-latest` (amd64) apt; Zulal ARM64’te resmi `k6-v0.55.0-linux-arm64` arşivi `$RUNNER_TEMP` altına checksum ile indirilir (kalıcı kurulum / sudo yok). eşikler (`http_req_failed`, status 200) değişmez.

## Diğer job’lar

| Job | Runner (varsayılan) | Zulal modunda |
|-----|---------------------|---------------|
| Contracts Type Check | `ubuntu-latest` | self-hosted Zulal |
| Detect Mobile Projects | `ubuntu-latest` | self-hosted Zulal |
| Cross-Language Contract Tests | `ubuntu-latest` (+ Java 17) | self-hosted Zulal |
| Secret Scan | `ubuntu-latest` | self-hosted Zulal |
| Load smoke (k6 profile 100) | `ubuntu-latest` | self-hosted Zulal |
| Android Gradle Build | `ubuntu-latest` | **skipped** (NOT_TESTED) veya Mac runner `on` ise **MacBook** |
| iOS Xcode Build | `macos-latest` | **skipped** (NOT_TESTED) veya Mac runner `on` ise **MacBook** |
| Swift Package Tests | `ubuntu-latest` | **skipped** (NOT_TESTED) veya Mac runner `on` ise **MacBook** |
| Build images and staging compose smoke | `ubuntu-latest` | **skipped** (NOT_TESTED) |

pnpm paralel job izolasyonu (`dest: ${{ runner.temp }}/pnpm-<job>`, `STORE_PATH` / `npm_config_store_dir` → `GITHUB_ENV`) hosted ve Zulal’da geçerlidir (`verify`, `load-smoke`, vb.).

İlgili ADR: `docs/adr/ADR-012-embedded-postgres-tests.md` (Zulal host PostgreSQL 17).
