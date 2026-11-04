# SOSMesh mesh v2 protocol (shared contract)

Status: **DRAFT for parallel implementation** (iOS, Android / Wear OS, server / panel).
Builds on: `docs/protocol/ble-v1.md` (GATT transfer), `packages/contracts/schemas/sos-message.schema.json` (v1 wire message),
`packages/contracts/protocol-v2/schemas/mesh-relay-envelope-v2.schema.json` (existing Android multihop envelope),
`POST /v1/ingest` (`apps/api/src/ingest`), the iOS relay in PR #132 and `apps/android/feature-relay`.

Key words MUST / SHOULD / MAY as in RFC 2119. All multi-byte integers are **big-endian**. "Hex" means lowercase hex.

---

## 0. Invariants (safety rules; any implementation that breaks one is wrong)

1. **Relays never decrypt.** Only the origin device and the server hold plaintext. Relays handle the v1 wire bytes as opaque.
2. **Peer ACK ≠ server receipt.** `PEER_RECEIVED` / `TRANSFER_VERIFIED` never mark a message delivered. Only a verified server
   signature (receipt or tombstone, §6) does.
3. **SOS is never blocked**: not by missing profile, empty content, rate limit (§8 coalesces instead of rejecting), missing
   permissions or no peers. The 112 call button stays visible on every SOS screen.
4. **PII only inside ciphertext.** Profile (§7) and precise GPS live only in the encrypted inner payload. The public envelope carries
   location rounded to 2 decimals (~1.1 km) with accuracy ≥ 1000 m, or `null`.
5. **No PII in logs, analytics, crash reports, BLE diagnostics or the repo.** Ids in logs only as short hashes (8 hex of SHA-256).
6. "Online via a neighbour" (§4) is a routing hint, never shown to the user as "delivered".

---

## 1. Layers and identifiers

| Layer | Object | Visible to relays | Defined in |
| --- | --- | --- | --- |
| L3 inner | `SosInnerPayloadV2` (JSON) | no (encrypted) | `protocol-v2/schemas/sos-inner-payload-v2.schema.json` |
| L2 wire | v1 `SosMessage` (`version:1`, `id`, public `envelope`, `encryptedPayload`) | yes, opaque except envelope | `schemas/sos-message.schema.json` (unchanged) |
| L1 mesh | `MeshRelayEnvelopeV2` (`protocolVersion:2`) wrapping L2 bytes | yes | `protocol-v2/schemas/mesh-relay-envelope-v2.schema.json` (unchanged) |
| L0 BLE | ble-v1 transfer (HELLO/chunks/ACK/VERIFIED) + v2 control frames (§5) | yes | ble-v1.md + §5 |

Identifiers:

| Name | Type | Definition |
| --- | --- | --- |
| `messageId` | string, UUID v4 lowercase, 36 chars | L2 `id`. Same value end to end. |
| `messageKey` | 16 bytes | `SHA-256(UTF-8(messageId))[0..16)`. Used on BLE and in seen caches. |
| `packetHash` | 64 hex | `SHA-256(canonicalJSON(L2 SosMessage))` where canonicalJSON = keys sorted, no whitespace, numbers as JSON numbers (matches server `computePacketHash` / contracts `canonicalJSON`). Relays compute it over the bytes they carry; they MUST NOT re-serialize L2. |
| `senderKey` | 64 hex (32 random bytes) | Per install, generated at first launch, Keychain (iOS, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) / EncryptedSharedPreferences (Android). **Only inside L3.** Server stores `senderKeyHash = SHA-256(senderKey)`. |
| `relayId` | 64 hex | Existing per-install random id used in `/v1/ingest relayInfo` (unchanged). |
| `deviceIdHash` | 64 hex | Existing `hopChainReceipt` entry (SHA-256 of per-install relay id). |

---

## 2. Message format

### 2.1 L3 inner payload v2

Schema: `sos-inner-payload-v2.schema.json`. Required: `innerVersion` (=2), `senderKey`, `seq`, `createdAt`.
Everything else optional, so **an empty SOS (no note, no photo, no audio, no location, no profile) is valid** (req. 6).
Limits: note ≤ 1000 chars and ≤ 2000 bytes; serialized L3 ≤ 4096 bytes before encryption; ≤ 4 attachment refs
(attachment bytes are never sent over BLE; they upload later with the receipt `uploadToken`).

Encryption: unchanged from v1 (`SOSMeshCrypto.encryptPayload`, AAD = public envelope fields). The server distinguishes v1/v2
inner by `innerVersion` (absent ⇒ v1 snake_case inner).

### 2.2 L2 wire message

Unchanged v1 `SosMessage`. Public envelope rules (already implemented): `location` rounded to 2 decimals, `accuracy = max(acc, 1000)`,
or `null` with `locationStatus = UNKNOWN`; `ackLevel = "DEVICE_STORED"`, `relayCount = 0` and **never modified by relays**
(modifying would change `packetHash`). Max L2 size: 16384 bytes.

### 2.3 L1 mesh envelope

Existing `MeshRelayEnvelopeV2`; `opaqueCiphertextBase64 = base64(L2 bytes)` (≤ 21848 chars). v2 fixes the parameters:

| Field | Origin value | Forward rule |
| --- | --- | --- |
| `hopCount` | 0 | +1 per forward |
| `maxHops` | **8** | unchanged; drop with `MAX_HOPS` when `hopCount ≥ maxHops` |
| `ttlHops` | 8 | −1 per forward; drop with `TTL_EXCEEDED` at 0 |
| `copyCount` / `maxCopyCount` | 1 / **16** | +1 per forward (existing engine rule). **Spec fix (iOS PR):** the shared engines add 1 to `copyCount` on every forward and drop with `COPY_CAP` when `copyCount ≥ maxCopyCount`, so the earlier value 4 would have ended every path after 3 hops, before the hop limit of 8. Origin value is now 16 (schema max). The spray limit is local instead: a device hands one carried copy to at most **4 distinct peers** (tracked in its seen cache). |
| `originCreatedAt` | L2 `envelope.timestamp` | unchanged. **Time TTL = originCreatedAt + 24 h** (= server `MAX_ENVELOPE_AGE_SECONDS`); expired copies are purged everywhere (drop reason `TIME_EXPIRED`) |
| `hopChainReceipt.relayDeviceIdHashes` | `[]` | append own `deviceIdHash`; drop with `LOOP_DETECTED` if already present |
| `peerAckHint` | `PEER_RECEIVED_ONLY` | unchanged |

A device MAY still send a bare L2 v1 message over BLE (v1 compatibility, §11); receivers wrap it as `hopCount=0` L1.

### 2.4 BLE transfer payload discriminator

The reassembled ble-v1 transfer payload is UTF-8 JSON, classified in this order:

1. `protocolVersion == 2` and `messageId` ⇒ L1 `MeshRelayEnvelopeV2`
2. `kind == "TOMBSTONES"` ⇒ `TombstoneBatchV2` (`tombstone-batch-v2.schema.json`)
3. `version == 1` and `id` ⇒ bare L2 v1 message
4. anything else ⇒ discard (transfer still VERIFIED at L0; no store).

---

## 3. Device state

### 3.1 Queues (persistent, survive restart)

| Queue | Content | Delete when |
| --- | --- | --- |
| **Own outbox** | origin device's own L2 + status history | never deleted by mesh; status → `SERVER_ACCEPTED` on valid receipt/tombstone; retention policy only |
| **Carry store** | L1 copies held for others (`origin=relay`) | valid tombstone, server receipt from own upload, time TTL, or capacity eviction (oldest `originCreatedAt` first, own outbox never evicted) |
| **Seen cache** | `messageKey → {firstSeenMs, state ∈ CARRYING, FORWARDED, DELIVERED}` | 72 h after `firstSeenMs`; cap 4096 entries (LRU) |
| **Tombstone store** | verified tombstones | `timestamp + 72 h`; cap 1024 |

Carry store cap: 200 messages or 2 MiB per device (watches: 20 / 256 KiB).

### 3.2 Own-message status (origin device only)

`LOCAL_SAVED → PEER_RECEIVED → SERVER_ACCEPTED → OPERATOR_SEEN → CASE_IN_PROGRESS` (existing fixture
`packages/fixtures/transport/state-transitions.json`, unchanged). `LOCAL_SAVED → SERVER_ACCEPTED` is allowed (direct upload or tombstone seen).
`PEER_RECEIVED` UX label: "Reached a nearby phone"; never "delivered".

### 3.3 Carry-copy state

```
RECEIVED --(gateway: upload accepted, receipt verified)--> DELIVERED  -> delete copy, keep tombstone
RECEIVED --(tombstone verified)--------------------------> DELIVERED  -> delete copy
RECEIVED --(forwarded to peer, VERIFIED at L0)-----------> RECEIVED   (copyCount bookkeeping only; copy kept)
RECEIVED --(time TTL / hops exhausted / evicted)---------> DROPPED    -> delete copy, seen cache keeps key
```

---

## 4. Gateway reachability (transitive online)

### 4.1 Definition

- `h = 0` (**gateway**): the device has validated internet: an HTTPS request to the SOSMesh API succeeded within the last 60 s
  (`GET /health` or any `/v1/*` 2xx/4xx). OS "network available" alone is not enough.
- `h = 1 + min(h_n)` over neighbours `n` with a **live BLE link or an advertisement/MESH_INFO from n seen ≤ 30 s ago** and `h_n ≤ 7`.
- Otherwise `h = 0xFF` (offline).
- Link failure, disconnect or 30 s without fresh info from the chosen parent ⇒ recompute immediately; if nothing qualifies ⇒ offline.
- Loop damping: a device never derives `h` from a neighbour whose `parentKey` (§5.3) equals its own `selfKey`; values only
  increase by at most 1 per 15 s ("hold-down").

`h` is a routing hint only (invariant 6).

### 4.2 Advertisement

| Platform | How `h` is advertised |
| --- | --- |
| Android / Wear OS | Service UUID `0xFFF0` + **Service Data** for `0xFFF0`: `[0]=0x02 version, [1]=h (0..8, 0xFF offline), [2]=flags` (3 bytes). flags bit0 relay on, bit1 accepts carry, bit2 watch, bit3 has own pending SOS. |
| iOS | iOS peripherals cannot advertise service data. Advertise service UUID `0xFFF0` **plus one** "hops UUID" `0xFFE0 + h` (`0xFFE0..0xFFE8`); no hops UUID ⇒ offline. In the background these UUIDs move to the overflow area and are only visible to iOS scanners that scan for them explicitly. |
| All | Authoritative value: read characteristic `MESH_INFO` (§5.3) after connecting. |

Scanners MUST filter on `0xFFF0` and `0xFFE0..0xFFE8` and parse both encodings.

### 4.3 Routing

When the device holds anything to send (own or carry):

1. Prefer the connected or seen peer with the **lowest `h`**; ties → strongest RSSI, then least recently attempted.
2. If `h_self = 0`, upload instead of forwarding (§9).
3. If no peer has `h < h_self`, the device MAY forward to an offline peer (spray-and-wait), at most 4 distinct peers per carried copy (§2.3).
4. Before every transfer: OFFER (§5.2). Never send a message the peer answers `HAVE` or `DELIVERED` to.

---

## 5. BLE GATT (service `0000FFF0-0000-1000-8000-00805F9B34FB`)

### 5.1 Characteristics

| UUID (16-bit) | Name | Properties | v | Use |
| --- | --- | --- | --- | --- |
| `FFF1` | CONTROL | read, write | v1 | HELLO, RESUME_REQUEST, **OFFER**, **TOMBSTONE_REQUEST** (central → peripheral) |
| `FFF2` | DATA | write | v1 | chunks |
| `FFF3` | ACK | read, write, notify | v1 | HELLO_ACK, ACK, NACK, TRANSFER_VERIFIED, **OFFER_REPLY**, **TOMBSTONE** (peripheral → central) |
| `FFF4` | MESH_INFO | read | **v2** | 16-byte status (§5.3) |

Writes use write-with-response. Chunk size = `maximumWriteValueLength(withResponse)` (iOS) / negotiated MTU − 3 (Android), clamped
100..512 for the ble-v1 HELLO `mtu` field. v1 peers simply lack `FFF4` ⇒ treat as v1 (§11).

### 5.2 New frames

| Type | Name | Direction / char | Layout |
| --- | --- | --- | --- |
| `0x30` | OFFER | central → `FFF1` | `[0x30][n u8 1..8][n × messageKey 16B]` (2 + 16n ≤ 130 B) |
| `0x31` | OFFER_REPLY | peripheral → `FFF3` notify | `[0x31][n u8][n × status u8]`; status `0 WANT`, `1 HAVE` (seen/carrying), `2 DELIVERED` (has tombstone), `3 FULL`, `4 REFUSED` (relay off / policy) |
| `0x32` | TOMBSTONE_REQUEST | central → `FFF1` | `[0x32][n u8 1..8][n × messageKey 16B]` |
| `0x34` | TOMBSTONE | peripheral → `FFF3` notify, one per frame | `[0x34][idLen u8][messageId UTF-8][packetHash 32B][tsLen u8][timestamp ASCII ≤ 32][signature 64B][hopsLeft u8]` (≤ 170 B; MUST fit `maximumUpdateValueLength`, else peripheral replies `FULL` and the central pulls via a TOMBSTONES transfer the other way next time) |

Rules:
- Central sends OFFER with all keys it intends to send in this session; transfers only `WANT` items, one ble-v1 transfer each.
- On `DELIVERED`, central sends TOMBSTONE_REQUEST, verifies each TOMBSTONE (§6) and purges.
- Central pushes its own tombstones (those the peer may lack) as a `TombstoneBatchV2` transfer, ≤ 16 per transfer, before any SOS transfer.
- Peripheral answers OFFER within 2 s or the central treats all as `WANT`.

### 5.3 MESH_INFO (`FFF4`, 16 bytes)

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 1 | version = `0x02` |
| 1 | 1 | `h` hops to gateway (0..8, `0xFF` offline) |
| 2 | 1 | flags (as §4.2) |
| 3 | 1 | carry-store fill %, 0..100 |
| 4 | 2 | seconds since `h` last confirmed (u16, saturating) |
| 6 | 4 | `selfKey` = first 4 bytes of SHA-256(relayId ‖ day-number UTC) (rotates daily) |
| 10 | 4 | `parentKey` (selfKey of the neighbour `h` was derived from; zeros if gateway/offline) |
| 14 | 2 | reserved, 0 |

---

## 6. Delivery tombstone

A tombstone **is** the `/v1/ingest` `receipt` object (`ackType, messageId, packetHash, timestamp, signature`) plus unsigned `hopsLeft`.
Schema: `delivery-tombstone-v2.schema.json`; batch: `tombstone-batch-v2.schema.json`.

Verification (all platforms, before any purge):
1. `ackType == "SERVER_ACCEPTED"`.
2. Ed25519 verify with the **bundled** receipt public key (same key as `ServerReceiptVerifier`, SPKI pinned in app config) over
   UTF-8 `SERVER_ACCEPTED|{messageId}|{packetHash}|{timestamp}`.
3. `now ≤ parse(timestamp) + 72 h` and `parse(timestamp) ≤ now + 300 s`.
4. Purge a carry copy only if its computed `packetHash` equals the tombstone's. On mismatch keep the copy (conflict; server flags it).

Effects:
- Relay/carry device: delete the copy, set seen-cache state `DELIVERED`, store tombstone, forward it with `hopsLeft − 1` (if > 0).
- Origin device: own outbox entry → `SERVER_ACCEPTED` (keeps history; nothing deleted). UX may say "Reached the server".
- Gateways get tombstones from their own `/v1/ingest` receipts (also for duplicates: the server returns the original receipt), and MAY
  call `POST /v1/receipts/lookup` (`receipt-lookup-v2.schema.json`) for carried copies before uploading.
- Unverifiable tombstones are dropped silently and never forwarded. DEBUG builds without a key never purge.

---

## 7. Profile (onboarding)

- Shown after notification permission; every field optional and skippable; "Skip" and "SOS" are always reachable; 112 visible.
- Fields = `SosInnerPayloadV2.profile`: fullName, age, address{line, district, city, postalCode, country}, floor, homeLocation, phone,
  email, householdSize.
- Storage: iOS Keychain item (`kSecClassGenericPassword`, `ThisDeviceOnly`, excluded from backup) / Android EncryptedSharedPreferences
  (AES-256-GCM, StrongBox if available). Not in the outbox, not in UserDefaults/SharedPreferences, not in logs.
- Sent **only** inside L3 of an SOS (full profile on the first SOS of a session, then only when `profileChanged`).
  No API, analytics or watch sync carries it (the watch gets a boolean "profile set").
- User can view, edit and delete the profile; deletion is local only (server copy follows server retention / deletion request).

---

## 8. Rate limits and person merge

### 8.1 Client (per `senderKey`)

- New SOS at most **1 per 60 s** and **10 per rolling hour**.
- If the user presses SOS inside the window, the app **never refuses**: when the previous own message has not left the device
  (`LOCAL_SAVED`, no peer ACK, no upload in flight) it is **replaced** (new `messageId`, `seq+1`, latest location/profile). Otherwise the new
  message is queued and released when the window opens. The UI shows "Queued, will be sent" + 112.
- Profile updates piggyback on the next SOS only (no standalone profile message).

### 8.2 Server

- Ingest decrypts L3 (already done for AI/plaintext source), computes `senderKeyHash`.
- **Merge**: same `senderKeyHash` and an incident not `CLOSED`/`RESOLVED` updated within 24 h ⇒ attach the message to that incident;
  incident `latestLocation` = newest by inner `location.timestamp`; status unchanged; event `SOS_MERGED`.
- **Limits**: ≤ 30 accepted per `senderKeyHash` per hour ⇒ accept + merge (receipt as normal). Above 60/h, or > `DEFAULT_RATE_LIMIT_MAX`
  per client IP/relayId per minute (existing), respond `429` + `Retry-After` (seconds). Relays treat 429 as retry (≤ 15 min backoff),
  never as delivered.
- The receipt format is unchanged; v2 adds optional response field `merged: boolean` (clients MUST ignore unknown fields).

---

## 9. Upload priority (gateway, `h = 0`)

Queue order:
1. **Own** pending messages (origin device), oldest first.
2. Carry copies by L2 `envelope.priority` ascending, then `originCreatedAt` ascending.

Upload = existing `/v1/ingest` with L2 unchanged: `relayInfo.hopCount = L1.hopCount + 1` (own: 0), `transport.ttlSeconds = 86400`,
`transport.packetHash` per §1. Backoff: no network 30 s; 5xx/429/invalid receipt 120 s (429 honours `Retry-After`, cap 900 s);
409 `MESSAGE_ID_CONFLICT` and other 4xx ⇒ park (`needs_review`/`http_NNN`), keep for retention, never forward again.
A device that just became a gateway drains own first, then carry, then pushes tombstones to connected peers.

---

## 10. Watches

### 10.1 Wear OS

Same as a phone when `BluetoothAdapter.getBluetoothLeAdvertiser()` is non-null and `FEATURE_BLUETOOTH_LE` peripheral mode is
supported (`isMultipleAdvertisementSupported`); otherwise central-only (like Apple Watch). Smaller caps (§3.1). Also forwards to the paired
phone over the Data Layer. MESH_INFO flag bit2 = 1.

### 10.2 Apple Watch (watchOS) — what the OS allows

- **No peripheral role**: `CBPeripheralManager` is unavailable on watchOS. The watch cannot advertise, cannot host the GATT server,
  cannot receive SOS from others, cannot be a carry/relay node and cannot advertise `h`.
- **Central role is available** (watchOS 4+), but: BLE runs only while the app is active or in an allowed background mode
  (e.g. an extended runtime / workout session); Apple documents a low number of concurrent peripheral connections (design for **1**);
  no state restoration guarantees; no background scanning for arbitrary devices.
- Design:
  1. Primary: WatchConnectivity to the paired iPhone (existing `PhoneWatchSessionManager` / `WatchSosCoordinator`); the iPhone owns the
     message (origin = watch user's iPhone senderKey).
  2. Fallback when the iPhone is unreachable and the app is foreground: scan for `0xFFF0` (+ hops UUIDs), connect to the lowest-`h` phone,
     OFFER + one ble-v1 transfer of its own L1 message (`hopCount=0`), then disconnect. It shows `PEER_RECEIVED` only.
  3. The watch keeps its own small outbox (existing `WatchOfflineQueue`), never a carry store.
- No promise of background relay, delivery latency or range on watchOS.

---

## 11. Backward compatibility

| Peer pair | Behaviour |
| --- | --- |
| v2 central → v1 peripheral (no `FFF4`) | skip OFFER; send bare L2 v1 message (ble-v1); peer uploads or stores as before |
| v1 central → v2 peripheral | receives bare L2; wraps as L1 `hopCount=0`; normal v2 handling |
| v1 client → server | unchanged `/v1/ingest`; inner without `innerVersion` = v1; no senderKey ⇒ no merge (one incident per message) |
| v2 client → old server | L2 unchanged ⇒ accepted; `merged` absent; lookup endpoint 404 ⇒ skip |

`SUPPORTED_PROTOCOL_VERSION` stays 1 (L2). v2 is a mesh + inner-payload revision only.

---

## 12. Server migration (additive only)

- `sos_sender` (`id uuid pk`, `sender_key_hash char(64) unique`, `created_at`, `last_seen_at`) — no raw senderKey.
- `sos_message.sender_id uuid null fk`, `sos_message.inner_version smallint null`, index (`sender_id`, `received_at desc`).
- `incident.latest_location_*` nullable columns (or reuse existing geo columns) + `incident.merged_message_count int default 1`.
- `sos_profile_snapshot` (encrypted at rest with the existing field-encryption key; `sos_message_id fk`, `ciphertext`, `created_at`);
  plaintext only in memory for the panel; retention = incident retention.
- No tombstone table: tombstones are receipts recomputed from `sos_message` (`messageId`, `packetHash`, `serverReceiptAt`).
- New endpoint `POST /v1/receipts/lookup` (public, rate-limited like ingest, ≤ 64 items).

## 13. Panel inference (address match)

- Server only, on decrypted L3: if `location` (accuracy ≤ 100 m) is within **100 m** of the geocoded `profile.address`
  (or `homeLocation`), show: "Assumption: may be at the registered address (floor F) with N people" (N = `personCount` ?? `householdSize`).
- Always labelled as an inference ("Varsayım"), never auto-dispatches, never changes priority automatically, disappears when the newest
  location is > 100 m away. Geocoding via server-side provider; addresses and coordinates never logged; audit records only
  `inference_shown` with incident id.

---

## 14. Test vectors (to add under `packages/contracts/protocol-v2/vectors/`)

| Id | Checks |
| --- | --- |
| `mk-001` | messageId → messageKey (16 B) |
| `ph-001` | L2 bytes → packetHash; equals server `computePacketHash` |
| `inner-empty` | minimal L3 (`innerVersion, senderKey, seq, createdAt`) validates; encrypts; ingest accepts |
| `inner-full-profile` | all profile fields at max length; ≤ 4096 B |
| `inner-oversize` | 4097 B ⇒ client rejects compose (UI still sends without the overflow field: drop note tail) |
| `env-public-rounding` | precise GPS → public 2-decimal location, accuracy ≥ 1000 |
| `l1-forward-hop7` / `l1-drop-hop8` | hop limit 8 |
| `l1-time-expired` | originCreatedAt + 24 h + 1 s ⇒ `TIME_EXPIRED` |
| `l1-loop` | own deviceIdHash in chain ⇒ `LOOP_DETECTED` |
| `seen-dup` | second OFFER of same key ⇒ `HAVE` |
| `offer-frame` / `offer-reply-frame` / `tomb-frame` | byte layouts §5.2 |
| `meshinfo-001` | 16-byte MESH_INFO encode/decode |
| `adv-android` / `adv-ios-hops` | `h` encodings §4.2 |
| `tomb-valid` | receipt signed with dev test key verifies; purge |
| `tomb-bad-sig` / `tomb-expired` / `tomb-hash-mismatch` | no purge, not forwarded |
| `gw-hops` | neighbour table → `h` incl. stale (31 s) and parent loop cases |
| `prio-queue` | own before carry; carry by priority then age |
| `rate-coalesce` | 2nd SOS at +30 s replaces unsent first; at +30 s after peer ACK ⇒ queued until +60 s |
| `server-merge` | 3 messages same senderKeyHash ⇒ 1 incident, newest location |
| `server-429` | 61st/h ⇒ 429 + Retry-After |
| `panel-infer-in` / `-out` | 80 m ⇒ inference shown; 150 m ⇒ hidden |

---

## 15. Open points (decide before coding)

- Day-rotating `selfKey` derivation needs a per-install secret if relayId must not be linkable across days.
- Exact geocoder and its data-processing terms (server side).
- Whether `sos_profile_snapshot` is kept per message or only the latest per sender.
