# ADR-012: API integration tests with embedded PostgreSQL

## Status

Accepted (ADIM 17)

## Context

SOSMesh CI runs on a self-hosted Linux ARM64 runner without Docker or sudo. Backend tests must exercise real PostgreSQL semantics (migrations, constraints, Prisma) rather than SQLite or mocks.

## Decision

On the Zulal self-hosted runner, API tests use a dedicated PostgreSQL 17 instance (`127.0.0.1:55432`). Workflow step `Load CI PostgreSQL credentials` sources `/etc/sosmesh-ci/pg.env` (masked into `GITHUB_ENV`). Jest `globalSetup` creates a unique database per run via `SOSMESH_CI_PG_ADMIN_URL`, migrates it, and `globalTeardown` drops it.

On cloud agent VMs and local dev (no CI env file), use the npm [`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres) package to download and start a temporary PostgreSQL instance in an isolated data directory during Jest `globalSetup`. Tests connect via a normal `DATABASE_URL`. The helper process is torn down in `globalTeardown`.

If neither CI PostgreSQL env nor embedded-postgres startup succeeds, tests fail explicitly (no silent skip).

`infra/compose/docker-compose.yml` remains available for optional local Docker-based development but is **not** used in CI (`NOT_TESTED` when Docker is unavailable).

## Consequences

- API tests in `apps/api/test` require ~5–10s startup for the embedded cluster on first run.
- Rollback coverage uses a hand-written `down.sql` beside the Prisma migration plus `prisma db execute`.
- No GitHub-hosted `services: postgres` containers are added (zero hosted-minute budget).
- Test helpers set `LC_ALL=C` / `LANG=C` on the embedded-postgres child process and pass `initdbFlags: ['--locale=C', '--encoding=UTF8']` (no `pnpm` patch of vendor `dist` files).

## Alternatives considered

- **Docker Compose in CI**: rejected (no Docker on Zulal runner).
- **SQLite via Prisma**: rejected (does not validate PostgreSQL indexes/FK behavior required by ADIM 17).
