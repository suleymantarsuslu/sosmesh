# infra/deploy

Backend deployment artifacts for SOSMesh (ADIM 54). **No real staging/prod deploy is executed in this step** — templates and CI smoke only.

| Path | Purpose |
|------|---------|
| `docker/` | Multi-stage, non-root Dockerfiles (`api`, `web`, `worker`, `migrate`) |
| `compose/docker-compose.staging.yml` | Staging-shaped stack for smoke tests |
| `compose/docker-compose.vulut.yml` | **VULUT Coolify production** (https://sosmesh.antiosoft.com) |
| `config/` | Cloud profile + per-env Meta/DB limit maps (names only) |
| `nginx/`, `ingress/`, `k8s/` | TLS and migration job templates (`BLOCKED_APPROVAL` until applied) |
| `nginx/vulut.conf` | **VULUT Coolify** nginx gateway (path routing, TLS via Traefik) |
| `docker/Dockerfile.gateway` | **VULUT Coolify** nginx gateway image |
| `scripts/container-smoke.sh` | `/health` + `/health/ready` checks after compose up |

Runbook: `docs/runbooks/deploy.md`  
Manual prod workflow draft: `docs/runbooks/deploy-workflow-draft.md`

## VULUT Coolify Deployment (Production)

**Live:** https://sosmesh.antiosoft.com  
**Stack:** `compose/docker-compose.vulut.yml` + `nginx/vulut.conf` + `docker/Dockerfile.gateway`  
**Branch:** `deploy/vulut-coolify` (tracked by Coolify; do not rewrite/delete)

### Architecture

- **TLS termination:** Coolify's Traefik (Let's Encrypt)
- **Gateway:** nginx routes `/health`, `/health/ready`, `/v1/*` → `api:3001`; all else → `web:3000`
- **No host ports:** Traefik reaches gateway over Coolify network
- **AI disabled:** `AI_ENABLED=false` (offline BLE SOS must work without AI)

### Required Environment Variables

Coolify injects these as environment variables (secret values never committed):

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET`
- `METRICS_SCRAPE_AUTH`
- `INGEST_RECEIPT_SIGNING_PRIVATE_KEY`
- `CORS_ORIGINS` (default: `https://sosmesh.antiosoft.com`)
- `TRUST_PROXY` (set to enable trusted proxy support for rate limiting)

### Trusted Proxy Configuration

Behind nginx gateway + Traefik, all clients appear as the proxy IP to the API. To enable correct client IP extraction for rate limiting:

- Set `TRUST_PROXY=1` (trust first proxy hop) or `TRUST_PROXY=2` for Traefik + nginx
- When enabled, API uses `X-Forwarded-For` header to identify real client IPs
- When disabled (default), API uses socket IP (all clients appear as proxy)

Nginx `vulut.conf` correctly forwards `X-Forwarded-For` and `X-Real-IP` headers.
