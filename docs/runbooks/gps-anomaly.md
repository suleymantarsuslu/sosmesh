# GPS / röle anomalisi (SosmeshGpsAnomalyBurst)

## Belirtiler

- `sosmesh_gps_anomaly_total` hızlı artış (eşik ≥ 10 / pencere — alert kuralı)
- Ingest `needsHumanReview` bayrakları artar
- Röle SOS metnini görmez; yalnızca aggregate anomali metrikleri

## Teşhis

1. Aynı `relayId` / clientKey kombinasyonunda burst var mı?
2. Harita panelinde koordinat sızıntısı **log/metrik etiketlerinde** olmamalı.

## Müdahale

- Şüpheli röleyi operasyonel listeden geçici devre dışı bırakın (config/policy).
- İnsan incelemesi kuyruğunu önceliklendirin.

## Not

- Peer ACK “okundu” sayılmaz; operatör `OPERATOR_SEEN` ayrı akıştır.
