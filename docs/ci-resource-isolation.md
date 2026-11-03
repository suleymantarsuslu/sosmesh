# CI Resource Isolation for Parallel Runners

## Problem
Two self-hosted runners on the same Zulal host (`zulal-runner-sosmesh` and `zulal-runner-sosmesh-2`, both labelled `zulal-verify`) run the "Verify Quality Gates" job concurrently, causing resource conflicts including port collisions and file path conflicts.

## Solution
Introduced per-runner port offsets derived from `RUNNER_NAME` in the CI workflow, with offset 0 for `zulal-runner-sosmesh` and offset 100 for `zulal-runner-sosmesh-2`.

## Isolated Resources

### Ports
All ports are now configurable via environment variables with defaults:

| Service | Environment Variable | Default | Offset 0 | Offset 100 |
|---------|---------------------|---------|----------|------------|
| Web (Next.js) | `WEB_PORT` | 3000 | 3000 | 3100 |
| API (NestJS) | `API_PORT` | 3001 | 3001 | 3101 |
| PostgreSQL | `PG_PORT` | 5432 | 5432 | 5532 |
| Redis | `REDIS_PORT` | 6379 | 6379 | 6479 |

**Note:** PostgreSQL and Redis ports are reserved for future use. CI uses dedicated database names per job via `SOSMESH_CI_DATABASE_URL`, and Redis is not used in CI verify jobs.

### Temporary Files
All temporary files are now suffixed with the API port to prevent conflicts:

| Original Path | New Path Pattern |
|--------------|------------------|
| `/tmp/sosmesh-smoke.env` | `/tmp/sosmesh-smoke-${API_PORT}.env` |
| `/tmp/sosmesh-smoke-pg-*.json` | `/tmp/sosmesh-smoke-${API_PORT}-pg-*.json` |
| `/tmp/sosmesh-smoke-migrate.log` | `/tmp/sosmesh-smoke-migrate-${API_PORT}.log` |
| `/tmp/sosmesh-api-smoke.log` | `/tmp/sosmesh-api-smoke-${API_PORT}.log` |
| `/tmp/sosmesh-web-smoke.log` | `/tmp/sosmesh-web-smoke-${API_PORT}.log` |
| `/tmp/sosmesh-load-smoke.env` | `/tmp/sosmesh-load-smoke-${API_PORT}.env` |
| `/tmp/sosmesh-load-smoke-pg-*.json` | `/tmp/sosmesh-load-smoke-${API_PORT}-pg-*.json` |
| `/tmp/ingest-preflight.json` | `/tmp/ingest-preflight-${API_PORT}.json` |
| `tests/load/.generated/api-smoke.log` | `tests/load/.generated/api-smoke-${API_PORT}.log` |

### Modified Files
1. `.github/workflows/ci.yml` - Added port offset derivation step
2. `scripts/smoke.sh` - Read ports from environment, unique temp files
3. `tests/load/ci-k6-smoke.sh` - Read API_PORT from environment, unique temp files
4. `playwright.web.config.js` - Read WEB_PORT from environment

### Docker Compose
Docker Compose (`infra/compose/docker-compose.yml` and `infra/deploy/compose/docker-compose.staging.yml`) is not used in CI verify jobs, so no changes were needed for compose project names or container names. Compose is only used for local development and deploy-container-smoke workflow.

### Database Isolation
PostgreSQL database isolation is already handled by the CI infrastructure:
- GitHub-hosted runners: Each job gets its own postgres service container
- Zulal self-hosted: `apps/api/test/helpers/smoke-ci-db.mjs` creates unique database names per job using the existing `SOSMESH_CI_PG_ADMIN_URL` and `SOSMESH_CI_DATABASE_URL` credentials

## Testing

### Local Parallel Testing
To test parallel execution locally, run two verify processes with different offsets:

```bash
# Terminal 1 - Runner 1 (offset 0)
export API_PORT=3001
export WEB_PORT=3000
bash scripts/verify.sh

# Terminal 2 - Runner 2 (offset 100)
export API_PORT=3101
export WEB_PORT=3100
bash scripts/verify.sh
```

### Individual Step Testing
Test smoke script with offset 100:
```bash
export API_PORT=3101
export WEB_PORT=3100
bash scripts/smoke.sh
```

Test Playwright with offset 100:
```bash
export WEB_PORT=3100
pnpm test:a11y:web
```

Test k6 load smoke with offset 100:
```bash
export API_PORT=3101
bash tests/load/ci-k6-smoke.sh
```

## Backward Compatibility
All changes are backward compatible:
- Default ports remain unchanged (3000, 3001, 5432, 6379)
- Local development and single-runner CI continue to work without changes
- Only multi-runner CI benefits from the offset mechanism
