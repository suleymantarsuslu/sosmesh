# Production deploy workflow taslağı (manuel onay)

**Bu dosya yalnızca dokümantasyondur.** `.github/workflows/` altına otomatik prod/staging deploy job **eklenmedi** (ADIM 54 kuralı). Uygulama: **BLOCKED_APPROVAL**.

## Amaç

- Staging'e artifact promote + smoke
- Production için GitHub Environment `production` + required reviewers
- Secret'lar GitHub Environments / secret manager üzerinden — repoda değil

## Taslak workflow (kopyalamayın — onay sonrası `.github/workflows/deploy-production.yml` olarak ekleyin)

```yaml
name: Deploy Production (MANUAL — DRAFT)

on:
  workflow_dispatch:
    inputs:
      image_tag:
        description: Immutable tag or digest for sosmesh-api/web/worker
        required: true
      confirm:
        description: Type DEPLOY to confirm
        required: true

jobs:
  guard:
    runs-on: ubuntu-latest
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    steps:
      - name: Require confirmation token
        run: |
          if [ "${{ github.event.inputs.confirm }}" != "DEPLOY" ]; then
            echo "Confirmation failed"
            exit 1
          fi

  deploy:
    needs: guard
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://CHANGE_ME_HOST/health/ready
    steps:
      - uses: actions/checkout@v4
      - name: Run migration job
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
        run: |
          echo "Apply infra/deploy/k8s/migration-job.yaml.template with approved image"
          exit 1  # placeholder — implement after cloud target chosen

      - name: Rollout API/Web/Worker
        run: |
          echo "Provider-specific rollout using SOSMESH_CLOUD_PROFILE"
          exit 1

      - name: Post-deploy smoke
        run: |
          curl -fsS "https://CHANGE_ME_HOST/health/ready"
          curl -fsS "https://CHANGE_ME_HOST/health"
```

## Environment protection (GitHub)

1. Settings → Environments → `production`
2. Required reviewers: proje sahibi
3. Secrets: `PRODUCTION_DATABASE_URL`, `JWT_SECRET`, `INGEST_RECEIPT_SIGNING_PRIVATE_KEY`, `MODEL_API_KEY` (opsiyonel)

## Staging promote (ayrı environment)

Benzer workflow `environment: staging` ile; smoke zorunlu (`infra/deploy/scripts/container-smoke.sh`).

**Durum:** hazır, uygulanmadı (BLOCKED_APPROVAL)
