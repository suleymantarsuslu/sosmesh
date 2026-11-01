# CI runner notları

## Genel

Tüm Linux CI job’ları GitHub-hosted `ubuntu-latest` üzerinde koşar (private repo **Actions dakika kotası**). iOS job’u `macos-latest` üzerinde kalır. Self-hosted Zulal runner’ları yedek / geri dönüş içindir; workflow’da `runs-on: [self-hosted, …]` referansı yoktur.

## Verify Quality Gates (`verify` job)

- **Runner:** `ubuntu-latest`.
- **PostgreSQL:** Job `services: postgres` (geçici `postgres:16`; yalnızca CI test parolası). Self-hosted `/etc/sosmesh-ci/pg.env` kullanılmaz.
- **Geri dönüş (Zulal):** `verify` job’unda `runs-on: ubuntu-latest` → `runs-on: [self-hosted, linux, ARM64, zulal]`; `services` / job `env` PostgreSQL bloklarını kaldırıp `Load CI PostgreSQL credentials` adımını geri ekleyin.

## Diğer job’lar

| Job | Runner |
|-----|--------|
| Contracts Type Check | `ubuntu-latest` |
| Detect Mobile Projects | `ubuntu-latest` |
| Cross-Language Contract Tests | `ubuntu-latest` (+ `actions/setup-java` temurin 17) |
| Secret Scan | `ubuntu-latest` |
| Android Gradle Build | `ubuntu-latest` |
| iOS Xcode Build | `macos-latest` |

**Geri dönüş (tüm Linux job’ları Zulal’a):** ilgili job’larda `runs-on: ubuntu-latest` satırlarını `runs-on: [self-hosted, linux, ARM64, zulal]` ile değiştirin; `verify` için yukarıdaki PostgreSQL adımını da geri alın.

pnpm paralel job izolasyonu (`dest: ${{ runner.temp }}/pnpm-<job>`, `STORE_PATH` / `npm_config_store_dir` → `GITHUB_ENV`) hosted’da da geçerlidir.
