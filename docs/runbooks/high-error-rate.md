# Yüksek HTTP hata oranı (SosmeshHighHttpErrorRate)

## Belirtiler

- `sosmesh_http_errors_total` artışı (5xx)
- Alert eşiği: ≥ 3 (CI senaryosu ile hizalı)
- `/metrics` ve Grafana observability dashboard

## Teşhis

1. Korelasyon: `x-request-id` / structured event `correlationId`.
2. Validation 4xx ile 5xx’i ayırın (4xx alert tetiklemez).
3. Son deploy diff ve migration durumu.

## Kurtarma

- Kök neden giderildikten sonra 5xx sayacı düşer; alert söner.
- Gerekirse rollback (`rollback.md`).

## Yasak

- Loglara SOS metni, telefon, gerçek GPS, token yazmayın.
