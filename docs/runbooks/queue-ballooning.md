# Şişen kuyruk (SosmeshIngestQueueBallooning)

## Belirtiler

- `sosmesh_ai_job_queue_depth >= 50`
- Ingest rate limit (`sosmesh_ingest_rate_limited_total`) artıyor olabilir

## İlk adımlar

1. AI worker runbook (`stuck-worker.md`).
2. Backpressure 429 beklenen davranıştır; kapasite artırımı kanıtsız iddia etmeyin.
3. k6 profil sonuçları: `docs/perf/perf-report.md`.

## Kurtarma

- Kuyruk derinliği normale dönünce alert söner.
- Gerekirse AI geçici kapalı + operatör manuel iş akışı.
