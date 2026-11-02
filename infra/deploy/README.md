# infra/deploy

Backend deployment artifacts for SOSMesh (ADIM 54). **No real staging/prod deploy is executed in this step** — templates and CI smoke only.

| Path | Purpose |
|------|---------|
| `docker/` | Multi-stage, non-root Dockerfiles (`api`, `web`, `worker`, `migrate`) |
| `compose/docker-compose.staging.yml` | Staging-shaped stack for smoke tests |
| `config/` | Cloud profile + per-env Meta/DB limit maps (names only) |
| `nginx/`, `ingress/`, `k8s/` | TLS and migration job templates (`BLOCKED_APPROVAL` until applied) |
| `scripts/container-smoke.sh` | `/health` + `/health/ready` checks after compose up |

Runbook: `docs/runbooks/deploy.md`  
Manual prod workflow draft: `docs/runbooks/deploy-workflow-draft.md`
