# Status page semantiği

Operatör paneli `/operator/health` (ADMIN/COORDINATOR) API özeti `statusPage` alanını gösterir.

## Genel durum (`overall`)

| Değer | Anlam |
| --- | --- |
| `operational` | Tüm izlenen bileşenler nominal |
| `degraded` | API 5xx eğilimi veya AI kuyruk/hata eşiği |
| `major_outage` | Veritabanı probe başarısız |

## Bileşenler

- **api:** `sosmesh_http_errors_total` eşiği (≥ 3 → degraded)
- **database:** `sosmesh_health_database_up` (0 → major_outage)
- **aiWorker:** kuyruk derinliği ≥ 50 veya AI failure eşiği → degraded

## İletişim

- Dış status page metni PII içermez; koordinat/SOS metni asla yayınlanmaz.
- Peer/radio ACK kullanıcıya “okundu” anlamına gelmez; yalnızca taşıma gecikmesi metrikleri.

## Public JSON (gelecek)

Harici status.json ayrı host’ta yalnızca aggregate enum değerleri taşıyabilir; bu repo yalnızca semantiği dokümante eder.
