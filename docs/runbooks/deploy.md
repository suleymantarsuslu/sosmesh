# Deploy runbook (ADIM 54)

**Durum özeti:** Kod ve şablonlar hazır. Gerçek staging/prod deploy, DNS, TLS sertifikası ve ücretli bulut kaynakları **hazır, uygulanmadı (BLOCKED_APPROVAL)**. Staging kanıtları bu aşamada **NOT_TESTED**.

## Kapsam

- Docker imajları: `infra/deploy/docker/` (`api`, `web`, `worker`, `migrate`)
- Staging compose: `infra/deploy/compose/docker-compose.staging.yml`
- Health: API `GET /health`, `GET /health/ready`; Web `GET /health`; Worker `GET /health/ready`
- Secret'lar: yalnızca secret manager / ortam değişkeni **adı** (`.env.example` değer içermez)
- Demo/staging: sentetik seed; gerçek PII yok (`apps/api/prisma/seed.ts`)

## Ön koşullar (kullanıcı onayı)

| Eylem | Durum |
|-------|--------|
| Staging DB provision (ayrı instance) | BLOCKED_APPROVAL |
| Secret manager kayıtları (`DATABASE_URL`, `JWT_SECRET`, `INGEST_RECEIPT_*`, isteğe bağlı `MODEL_API_KEY`) | BLOCKED_APPROVAL |
| DNS + TLS (Let's Encrypt veya kurumsal CA) | BLOCKED_APPROVAL |
| Production deploy | BLOCKED_APPROVAL |
| Uptime/audit entegrasyonu (harici SaaS) | BLOCKED_APPROVAL |

## 1. Staging deploy (prosedür — uygulanmadı)

1. `SOSMESH_CLOUD_PROFILE` seçin (`infra/deploy/config/cloud-provider.yaml`).
2. Staging limitlerini uygulayın: `infra/deploy/config/meta-limits.staging.yaml` → env.
3. Migration job:
   - Compose: `docker compose -f infra/deploy/compose/docker-compose.staging.yml run --rm migrate`
   - K8s: `infra/deploy/k8s/migration-job.yaml.template` (image + `DATABASE_URL` secret)
4. Servisleri ayağa kaldırın (compose veya orchestrator).
5. TLS: `infra/deploy/nginx/staging.conf.template` veya `ingress.staging.yaml.template` — sertifika yollarını doldurup nginx/ingress reload.

**Beklenen kanıt (NOT_TESTED şablonu):** `docs/handover/evidence/adim54/staging-deploy-log.template.txt`

## 2. Smoke test

Yerel/CI (GitHub-hosted, fork guard'lı job `deploy-container-smoke`):

```bash
bash infra/deploy/scripts/container-smoke.sh
```

Manuel staging smoke checklist:

- [ ] API `/health` 200
- [ ] API `/health/ready` 200 (DB up)
- [ ] Web `/health` 200
- [ ] Worker `/health/ready` 200
- [ ] Operatör login yalnızca sentetik hesap (`operator-demo@sosmesh.example`) — gerçek PII yok

**Kanıt şablonu:** `docs/handover/evidence/adim54/smoke-results.template.txt` → sonuç: **NOT_TESTED** until executed.

## 3. Snapshot (rollback öncesi)

Staging DB ve imaj digest'lerini kaydedin (araç sağlayıcıya göre değişir; kod repo'da yok).

Checklist:

- [ ] Postgres snapshot / PITR noktası
- [ ] Container imaj digest'leri (`api`, `web`, `worker`)
- [ ] Migration revision (`prisma migrate status`)

**Durum:** BLOCKED_APPROVAL — kullanıcı onayı + bulut hesabı gerekir.

## 4. Rollback denemesi

1. Önceki imaj tag/digest'e deployment geri al.
2. Gerekirse DB snapshot'tan restore (ayrı runbook ADIM 49).
3. Migration geri alma: yalnızca test edilmiş `down` scriptleri; prod'da otomatik down yok.

**Kanıt şablonu:** `docs/handover/evidence/adim54/rollback-trial.template.txt` → **NOT_TESTED**

## 5. TLS doğrulama

```bash
# Örnek — staging host adınızı kullanın (henüz uygulanmadı)
openssl s_client -connect staging.example.com:443 -servername staging.example.com </dev/null 2>/dev/null | openssl x509 -noout -dates -subject
curl -fsSI "https://staging.example.com/health/ready"
```

nginx/ingress şablonları HSTS ve TLS 1.2+ içerir.

## 6. DNS / sertifika

- DNS A/AAAA → load balancer / nginx
- cert-manager veya nginx `ssl_certificate` yolları
- Prod host adları repoda **yok** — secret manager / kullanıcı onayı

## 7. Uptime ve audit

- Uptime probe: `GET /health/ready` (API), `GET /health` (web)
- Audit: mevcut `audit_logs` API'si; dashboard PII içermez (ADR-013)
- Harici status page: BLOCKED_APPROVAL

## 8. Ortam ayrımı

| Ortam | DB | Meta limitleri |
|-------|-----|----------------|
| development | local compose | mock / kapalı |
| staging | ayrı URL | `meta-limits.staging.yaml` |
| production | ayrı URL | `meta-limits.production.yaml` + onay |

`SOSMESH_ENV` ve `DATABASE_URL` asla paylaşılmaz.

## 9. CI (bu repo)

- **Var:** `deploy-container-smoke` — imaj build + staging compose + smoke (ubuntu-latest, fork guard)
- **Yok (bilerek):** otomatik staging/prod deploy job — prod taslağı: `docs/runbooks/deploy-workflow-draft.md`

## 10. Kırmızı çizgiler

- SOSMesh 112 yerine geçmez
- Röle SOS metnini görmez; peer ACK ≠ operatör okundu
- Gerçek GPS/PII/sağlık verisi repoya/loga yazılmaz

## Kanıt durumu (ADIM 54)

| Kanıt | Durum |
|-------|--------|
| Staging deploy log | NOT_TESTED |
| Smoke | NOT_TESTED (CI job tanımlı; merge sonrası run id ile güncellenir) |
| Rollback trial | NOT_TESTED |
| TLS verification | NOT_TESTED |

**GEÇTİ ölçütü** (staging çalışır + prod onaylı) henüz karşılanmadı → `status.json` adım 54: **PARTIAL**.
