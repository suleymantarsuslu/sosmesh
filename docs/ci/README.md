# CI runner notları

## Genel

Linux CI job’ları varsayılan olarak GitHub-hosted `ubuntu-latest` üzerinde koşar (private repo **Actions dakika kotası**). iOS job’u `macos-latest` üzerinde kalır.

## Geçici Zulal fallback (`vars.SOSMESH_CI_RUNNER`)

GitHub Actions faturalama / kota sorunlarında koordinatör repo değişkenini `SOSMESH_CI_RUNNER=zulal` yapabilir. Bu durumda şu job’lar Zulal self-hosted runner’da koşar: `verify`, `contracts`, `detect-mobile`, `cross-language-contracts`, `secret-scan`.

**Geri almak:** değişkeni silmek veya `zulal` dışı bir değere çevirmek yeterli; workflow tekrar `ubuntu-latest` kullanır.

`android-gradle`, `ios-xcode` ve `swift-package-tests` job’ları **her zaman** GitHub-hosted runner’da kalır (`ubuntu-latest` / `macos-latest`).

## Verify Quality Gates (`verify` job)

- **Runner:** `ubuntu-latest`, veya `SOSMESH_CI_RUNNER=zulal` iken `[self-hosted, linux, ARM64, zulal]`.
- **PostgreSQL (hosted):** Job `services: postgres` (`postgres:16`; yalnızca CI test parolası). Job `env` ile `SOSMESH_CI_*_URL` tanımlıdır.
- **PostgreSQL (Zulal):** Service container kullanılmaz; `Load CI PostgreSQL credentials` adımı `/etc/sosmesh-ci/pg.env` dosyasını yükler (`::add-mask::` ile).
- **Playwright:** Hosted modda `npx playwright install --with-deps chromium`; Zulal modda `npx playwright install chromium` (sudo yok).
- Zulal modunda `verify`, port 3000/3001 çakışmasını önlemek için `zulal-verify` etiketli tek runner'da sırayla koşar.

## Diğer job’lar

| Job | Runner (varsayılan) | Zulal modunda |
|-----|---------------------|---------------|
| Contracts Type Check | `ubuntu-latest` | self-hosted Zulal |
| Detect Mobile Projects | `ubuntu-latest` | self-hosted Zulal |
| Cross-Language Contract Tests | `ubuntu-latest` (+ Java 17) | self-hosted Zulal |
| Secret Scan | `ubuntu-latest` | self-hosted Zulal |
| Android Gradle Build | `ubuntu-latest` | `ubuntu-latest` (değişmez) |
| iOS Xcode Build | `macos-latest` | `macos-latest` (değişmez) |
| Swift Package Tests | `ubuntu-latest` | `ubuntu-latest` (değişmez) |

pnpm paralel job izolasyonu (`dest: ${{ runner.temp }}/pnpm-<job>`, `STORE_PATH` / `npm_config_store_dir` → `GITHUB_ENV`) hosted ve Zulal’da geçerlidir.
