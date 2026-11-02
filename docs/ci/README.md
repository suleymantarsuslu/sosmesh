# CI runner notları

## Genel

Linux CI job’ları varsayılan olarak GitHub-hosted `ubuntu-latest` üzerinde koşar (private repo **Actions dakika kotası**). iOS job’u `macos-latest` üzerinde kalır (Zulal modunda **atlanır**; aşağıya bakın).

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

PR’larda `Mobile verification deferred (MacBook phase)` job’u yalnızca Zulal’da koşar ve `$GITHUB_STEP_SUMMARY` içine bu NOT_TESTED satırlarını yazar (sahte PASS yok).

## Verify Quality Gates (`verify` job)

- **Runner:** `ubuntu-latest`, veya `SOSMESH_CI_RUNNER=zulal` iken `[self-hosted, linux, ARM64, zulal, zulal-verify]`.
- **PostgreSQL (hosted):** Job `services: postgres` (`postgres:16`; yalnızca CI test parolası). Job `env` ile `SOSMESH_CI_*_URL` tanımlıdır.
- **PostgreSQL (Zulal):** Service container kullanılmaz; `Load CI PostgreSQL credentials` adımı `/etc/sosmesh-ci/pg.env` dosyasını yükler (`::add-mask::` ile).
- **Playwright:** Hosted modda `npx playwright install --with-deps chromium`; Zulal modda `npx playwright install chromium` (sudo yok).
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
| Android Gradle Build | `ubuntu-latest` | **skipped** (NOT_TESTED) |
| iOS Xcode Build | `macos-latest` | **skipped** (NOT_TESTED) |
| Swift Package Tests | `ubuntu-latest` | **skipped** (NOT_TESTED) |
| Build images and staging compose smoke | `ubuntu-latest` | **skipped** (NOT_TESTED) |

pnpm paralel job izolasyonu (`dest: ${{ runner.temp }}/pnpm-<job>`, `STORE_PATH` / `npm_config_store_dir` → `GITHUB_ENV`) hosted ve Zulal’da geçerlidir (`verify`, `load-smoke`, vb.).

İlgili ADR: `docs/adr/ADR-012-embedded-postgres-tests.md` (Zulal host PostgreSQL 17).
