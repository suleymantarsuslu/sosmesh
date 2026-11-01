# CI runner notları

## Verify Quality Gates (`verify` job)

- **Runner:** GitHub-hosted `ubuntu-latest` (private repo dakika kotası).
- **PostgreSQL:** Job `services: postgres` (geçici `postgres:16`; yalnızca CI test parolası). Self-hosted `/etc/sosmesh-ci/pg.env` bu job’da kullanılmaz.
- **Geri dönüş (self-hosted Zulal):** `.github/workflows/ci.yml` içinde `verify` job’unda `runs-on: ubuntu-latest` satırını `runs-on: [self-hosted, linux, ARM64, zulal]` yapın; `services` / job `env` PostgreSQL bloklarını kaldırıp `Load CI PostgreSQL credentials` adımını geri ekleyin.

Diğer self-hosted job’lar (Contracts Type Check, Cross-Language Contract Tests, Secret Scan) değişmeden Zulal’da kalır.
