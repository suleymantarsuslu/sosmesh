# SOSMesh sistem diyagramı (M0)

```mermaid
flowchart LR
  subgraph mobileA [Android A — afetzede]
    SOS[SOS formu]
    OB_A[Outbox / durum motoru]
    BLE_A[BLE sender]
    SOS --> OB_A --> BLE_A
  end

  subgraph mobileB [Android B — röle]
    BLE_B[BLE receiver]
    OB_B[Outbox relay]
    UPL[HTTPS ingest uplink]
    BLE_B --> OB_B --> UPL
  end

  subgraph backend [NestJS API]
    ING[POST /v1/ingest]
    DB[(PostgreSQL)]
    AIW[AI worker Meta]
    FEED[Operator feed SSE]
    ING --> DB
    DB --> AIW
    ING --> FEED
  end

  subgraph web [Next.js operatör paneli]
    MAP[Harita / vaka listesi]
    DET[Vaka ayrıntı + OPERATOR_SEEN]
    MAP --> DET
  end

  BLE_A <-- BLE mesh --> BLE_B
  UPL --> ING
  FEED --> MAP
  DET --> ING
```

## Veri sınırları

- Röle cihazları şifreli **envelope** taşır; SOS düz metni röle UI’sında görünmez.
- AI yalnızca backend worker’da; operatör UI’da **öneri/taslak** etiketi.
- Peer ACK, operatör görüldü (OPERATOR_SEEN) olayından ayrıdır.

## İlgili dokümanlar

- [overview.md](./overview.md)
- [requirements-map.md](./requirements-map.md)
- [../handover/status.json](../handover/status.json)
