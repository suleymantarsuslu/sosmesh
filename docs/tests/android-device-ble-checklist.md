# Android manual BLE device checklist

Physical two- and three-phone checks. Results remain **NOT_TESTED** until executed on real hardware (no CI substitute).

## Prerequisites

- `assembleProdDebug` on all test phones, airplane mode on (Wi‑Fi/cellular off), Bluetooth on.
- Complete startup **permission gate** (all runtime permissions + Bluetooth on).
- Phone B: enable **volunteer relay** if testing relay ingest (optional for pure peer receive).

## Two phones (A → B)

| Step | Phone A | Phone B | Expected |
|------|---------|---------|----------|
| 1 | Create SOS (guided or express) | Relay/discovery active | A outbox `LOCAL_SAVED` |
| 2 | Wait for peer discovery + GATT READY | Advertising + GATT server | Transfer starts |
| 3 | — | — | A status **PEER_RECEIVED** (not operator read) |
| 4 | — | Relay outbox row if B is relay | Opaque blob, no plaintext decrypt |

## Three phones (A → relay B → C)

| Step | Phone A | Phone B (relay) | Phone C |
|------|---------|-----------------|---------|
| 1 | Send SOS | Relay on, mesh-v2 forward enabled | Relay on |
| 2 | PEER_RECEIVED to B | Forward queue drains over BLE | Receives forwarded envelope |
| 3 | — | Outbox `origin=relay` | Second hop PEER / relay outbox |

## Failure checks

- Deny Bluetooth permission: gate blocks home; SOS flow shows permission hint.
- CRC/digest failure: stays `LOCAL_SAVED` (JVM unit tests cover codec gates).

Record build fingerprint and `adb logcat` only with redacted tags; no SOS payload in logs.
