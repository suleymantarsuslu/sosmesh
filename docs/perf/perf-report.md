# ADIM 47 — Performans ve yük ölçüm raporu

**Durum:** PARTIAL — profil **100** yerel/CI ölçüldü; profil **1000** ve **10000** **ERTELENDİ** (ağır yük yalnızca geliştirici makinesinde `tests/load/run-profile.sh` ile).

**Önemli uyarı:** Aşağıdaki sayılar bu ortamda (Cloud Agent VM / GitHub `ubuntu-latest` runner, tek Node süreci, embedded PostgreSQL veya CI servis postgres:16) ölçülmüştür. **Üretim kapasitesini temsil etmezler**; “ölçeklenebilir” iddiası yoktur.

## Ölçüm ortamı

| Alan | Değer |
|------|--------|
| API | `@sosmesh/api` NestJS, `AI_ENABLED=false` (yük testi) |
| Veritabanı | Yerel embedded PostgreSQL 17 veya CI `postgres:16` |
| Yük aracı | k6 v0.55 (profil 100 smoke), Jest `perf-adim47.spec.ts` (sıralı 100 ingest) |
| Ağ | `127.0.0.1` — harici/prod URL **yok** |

## Sentetik SOS ingest — profil 100

### Jest (sıralı, tek worker, supertest)

| Metrik | Değer (ms) |
|--------|------------|
| **p50** | **5,93** |
| **p95** | **7,50** |

Kaynak: `apps/api/test/perf-adim47.spec.ts` — `ADIM47_JEST_LATENCY_SAMPLE` çıktısı (2026-11-01 VM koşusu).

### k6 (CI smoke: `K6_VUS=1`, 100 iterasyon, paylaşımlı sentetik gövdeler)

CI job `load-smoke` (`tests/load/ci-k6-smoke.sh`) bu profili koşar. Yerel doğrulamada port 3001’de eski süreç kalmaması için `release_port` (lsof) kullanılır.

Özet JSON: `tests/load/.generated/k6-summary-100.json` (artifact: `k6-smoke-summary`).

| Metrik | Not |
|--------|-----|
| p50 / p95 | CI run artifact’ından okunur; VM’de stale özet dosyasına güvenmeyin |
| Başarısız istek oranı | Preflight + eşik: `http_req_failed < 5%` |

## ERTELENDİ profiller

| Profil | Iterasyon | CI | Gerekçe |
|--------|-----------:|:--:|---------|
| 1000 | 1000 | Hayır | Runner/VM burst kapasitesi üretim temsili değil; maliyet/yük politikası |
| 10000 | 10000 | Hayır | Aynı |

Elle: `BASE_URL=http://127.0.0.1:3001 bash tests/load/run-profile.sh 1000` (docker compose postgres + migrate + seed + API gerekir).

## Backpressure (429)

`INGEST_RATE_LIMIT_MAX=3` iken 6 ardışık ingest denemesinde en az bir **429** döner (`perf-adim47.spec.ts`). Bu, istemci başına kabul edilen burst sınırıdır; AI veya operatör onayı ile karıştırılmamalıdır.

## Hata davranışı ve kurtarma

| Senaryo | Beklenen | Kanıt |
|---------|----------|--------|
| Operatör feed insert hatası | SOS satırı rollback; retry tek satır | `operator-feed-transaction.spec.ts` |
| API süreç restart | `after=<seq>` cursor tutarlı; tek feed satırı | `perf-adim47.spec.ts` |
| SSE / polling reconnect | `?after=` ile yinelenmeyen olaylar | `sync-events.spec.ts`, `perf-adim47.spec.ts` |
| AI kapalı / outage | Ingest **200**, `SERVER_ACCEPTED` | `perf-adim47.spec.ts`, `ai-worker.spec.ts` |

## DB profil ve read replica

- Migration `20261101220000_adim47_perf_indexes`: `sos_messages (priority, received_at DESC)`, `received_at DESC`.
- EXPLAIN doğrulaması: `perf-adim47.spec.ts` (120 seed sonrası index kullanımı).
- SQL notları: `tests/load/profile/explain-operator-queries.sql`.
- **Read replica:** Ölçülen hacimde operatör feed poll primary üzerinde index yeterli; replica **zorunlu değil** (10k profil ERTELENDİ — yeniden değerlendirme prod-benzeri donanımda).

## Mobil dayanıklılık (unit)

| Platform | Test | Konu |
|----------|------|------|
| Android | `OutboxAdim47CapacityTest` | 1000 bekleyen zarf, TTL purge |
| iOS/Swift contracts | `TransportOutboxTests` | 1000 zarf, TTL ile düşük depolama simülasyonu |

Android SDK bu VM’de yok; `./gradlew test` **CI `android-gradle` job** ile doğrulanır.

## Dashboard

Yalnızca yapılandırma (ücretli Grafana Cloud yok): `infra/monitoring/grafana/dashboard-sosmesh-perf.json`. Metrik isimleri ADIM 48 OTEL export ile eşleşecek şekilde şablondur.

## Kırmızı çizgiler (doğrulandı)

- Sentetik fixture metinleri; gerçek GPS/PII/sağlık verisi yok.
- AI kapalıyken ingest devam eder; AI triyaj/sevk kararı vermez.
- Peer ACK ≠ operatör okundu (mobil/outbox testleri ayrı adımlarda).
