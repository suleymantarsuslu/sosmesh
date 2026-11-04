# iOS BLE relay: offline SOS -> nearby iPhone -> server

## Roles

| Device | Scans | Advertises + GATT server | Connects as central |
| --- | --- | --- | --- |
| Any device | yes | only when relay mode is on | only to hand over its **own** pending SOS |
| Relay (switch on) | yes | yes (also while it has its own pending SOS) | only for its own pending SOS |

`AppModel.relayEnabled` is persisted (`UserDefaults`, key `sosmesh.relay.enabled`, default off) and
re-plans the radio immediately. `BleRoleSelector` still describes the cross-platform default; the app
forces `advertise = true` whenever relay mode is on.

## Flow

1. Offline sender: SOS is composed, encrypted and stored in the outbox (`LOCAL_SAVED`).
2. Sender scans for the service UUID; as soon as a peer is seen (or on the 2 s tick) and an own SOS is due it connects,
   discovers the three characteristics, subscribes to ACK notifications and only then reports the link ready.
   Chunk size comes from `maximumWriteValueLength(for: .withResponse) + 3` (clamped 100...512).
3. HELLO / chunks / ACK / TRANSFER_VERIFIED as in `ble-v1`. On the verified digest the sender sets `PEER_RECEIVED`.
   **`PEER_RECEIVED` is a nearby-phone ACK only; it is never shown as server receipt.**
4. Relay phone: the outer wire JSON (id only is read; the encrypted payload stays opaque) is stored in the in-memory inbox and in the
   on-disk outbox with `origin = relay` (survives restarts), `LOCAL_SAVED`.
5. While relay mode is on and the phone is online, `RelayForwarder` uploads the **unchanged** envelope to `POST /v1/ingest`
   (same body as the own-SOS and Android relay upload: `sosMessage`, `relayInfo{relayId,hopCount,relayTimestamp}`,
   `transport{ttlSeconds,packetHash}`). Only a verified signed `SERVER_ACCEPTED` receipt moves the entry to `SERVER_ACCEPTED`
   and marks the inbox row forwarded.
6. Failures: no network -> retry in 30 s; 5xx/429/bad receipt -> retry in 120 s; 409 (`MESSAGE_ID_CONFLICT`) and other 4xx -> parked
   (`needs_review` / `http_NNN`, not retried). The server de-duplicates on message id + packet hash and records a relay receipt.
7. Original sender, when it later has internet, still uploads its own copy (also from `PEER_RECEIVED`); the server dedupes.

## Diagnostics (Relay screen)

Counters and flags only (`RelayDiagnostics`): Bluetooth state, scanning, advertising, peers seen, connected, last sent/received time,
pending forward count, forwarded count, last error code. Message ids are shown only as 8-hex short hashes; no payloads, text or GPS.
There is no `os_log`/`print` in `CoreBLE` (`BleRelayPrivacyTests`).

## Known limits

- iOS suspends BLE when the app is not in the foreground; the relay phone should keep the app open (see `ios.limitation.force_quit`).
- ACK notifications are tiny (<= 49 B); they rely on the iOS-to-iOS ATT MTU negotiation.
