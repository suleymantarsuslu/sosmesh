# ADIM 47 — load and resilience (local / CI postgres only)

Synthetic SOS ingest load tests using [k6](https://grafana.com/docs/k6/). **Do not** point these scripts at production or paid hosted APIs.

## Profiles

| Profile | Iterations | CI | Notes |
|--------:|-----------:|:--:|-------|
| 100 | 100 | yes | `tests/load/ci-k6-smoke.sh` |
| 1000 | 1000 | no | **ERTELENDİ** — run manually on a developer machine |
| 10000 | 10000 | no | **ERTELENDİ** — run manually; not representative of prod capacity |

## Prerequisites

- PostgreSQL reachable via `DATABASE_URL` or `SOSMESH_CI_DATABASE_URL`
- Built API (`pnpm --filter @sosmesh/api build`)
- k6 installed for manual profiles (`run-profile.sh` checks)

## Commands

```bash
# CI smoke (profile 100)
bash tests/load/ci-k6-smoke.sh

# Manual heavier profiles (local API must already listen on BASE_URL)
BASE_URL=http://127.0.0.1:3001 bash tests/load/run-profile.sh 1000
BASE_URL=http://127.0.0.1:3001 bash tests/load/run-profile.sh 10000
```

Generated artifacts land under `tests/load/.generated/` (gitignored).
