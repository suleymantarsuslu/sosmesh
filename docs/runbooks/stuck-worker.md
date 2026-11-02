# Takılan AI worker (SosmeshAiWorkerStuck)

## Belirtiler

- `sosmesh_ai_job_queue_depth > 0` uzun süre sabit
- Alert: `SosmeshAiWorkerStuck` (120s ilerleme yok + kuyruk > 0)
- Ingest hâlâ 200; AI önerisi gecikir (AI triyaj/kurtarma kararı vermez)

## İlk adımlar

1. `AI_ENABLED=false` ile AI’yı geçici kapatmayı değerlendirin (ingest etkilenmez).
2. Meta/model kesintisi mi kontrol edin (harici URL yalnızca bilinen endpoint; repoda secret yok).
3. Worker kuyruk derinliği ve `sosmesh_ai_failures_total` trendine bakın.

## Kurtarma

- Kuyruk boşalır → gauge 0, alert söner.
- Kalıcı hata → model provider outage runbook + operatör manuel sınıflandırma.

## Rollback

- Son deploy AI worker değiştirdiyse `rollback.md`.
