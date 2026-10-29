# SOSMesh — Çapraz Platform Sözleşme Matrisi

**Versiyon:** 1.0  
**Tarih:** 2026-10-29  
**Kapsam:** ADIM 03 (Hackathon / Çekirdek)

---

## 1. Giriş

Bu dokü

man her platform'un (Android, iOS, Wear OS, watchOS, API, Web) hangi sözleşmeleri **ürettiğini**, **tükettiğini** ve **geçirdiğini** (relay) gösterir.

**Sözleşme Tipleri:**
- **Envelope (Outer):** BLE transport katmanı (plaintext routing metadata)
- **Payload (Inner):** Şifreli SOS içeriği
- **ACK (Acknowledgment):** Durum onay mesajları
- **API Request/Response:** HTTP endpoint sözleşmeleri
- **SSE Events:** Operatör panel feed

---

## 2. Platform Rolleri

| Platform | Roller | Üretir | Tüketir | Geçirir |
|----------|--------|--------|---------|---------|
| **Android (Afetzede)** | SOS Gönderen | ✅ Envelope, Payload | ✅ ACK (PEER_RECEIVED, SERVER_ACCEPTED) | ❌ |
| **Android (Relay)** | Röle | ❌ (forwarding only) | ✅ Envelope (routing metadata) | ✅ Envelope → API |
| **iOS (Afetzede)** | SOS Gönderen | ✅ Envelope, Payload | ✅ ACK | ❌ |
| **iOS (Relay)** | Röle | ❌ | ✅ Envelope (routing metadata) | ✅ Envelope → API |
| **Wear OS** | Companion SOS | ✅ SOS (Data Layer) | ✅ ACK (telefon üzerinden) | ❌ |
| **watchOS** | Companion SOS | ✅ SOS (Watch Connectivity) | ✅ ACK (iPhone üzerinden) | ❌ |
| **Backend API** | Ingest + Worker | ✅ ACK, AI Analysis | ✅ Envelope, Payload (decrypted) | ❌ |
| **Web Panel** | Operator UI | ✅ Status Update | ✅ SSE Events, Case Data | ❌ |

---

## 3. Sözleşme Matrisi (Detaylı)

### 3.1 Envelope (Outer) — BLE Transport

**Schema:** `schemas/sos-envelope.schema.json`

| Alan | Tip | Üretir | Tüketir | Geçirir | Not |
|------|-----|--------|---------|---------|-----|
| `version` | int | Android, iOS | Android, iOS, API | Relay | Protocol version (1) |
| `message_id` | UUID | Android, iOS | Tümü | Relay | Idempotency key |
| `created_at` | ISO8601 | Android, iOS | API | Relay | Origin timestamp |
| `ttl_seconds` | int | Android, iOS | Relay, API | Relay | Expiry (86400) |
| `hop_count` | int | Android, iOS | Relay (increment) | Relay | Multihop counter |
| `max_hops` | int | Android, iOS | Relay | Relay | Max 5 |
| `inner_payload_encrypted` | base64 | Android, iOS | API (decrypt) | Relay (opaque) | E2E encrypted |
| `inner_payload_nonce` | base64 | Android, iOS | API | Relay | AES-GCM nonce |
| `envelope_signature` | base64 | Android, iOS | API | Relay | HMAC-SHA256 |

**Platform Mapping:**

| Platform | Üretir | Tüketir (Routing) | Decrypt Inner | Geçirir |
|----------|--------|-------------------|---------------|---------|
| **Android (Afetzede)** | ✅ | ❌ | ✅ (own payload) | ❌ |
| **Android (Relay)** | ❌ | ✅ (hop_count, TTL) | ❌ | ✅ → API |
| **iOS (Afetzede)** | ✅ | ❌ | ✅ (own payload) | ❌ |
| **iOS (Relay)** | ❌ | ✅ (hop_count, TTL) | ❌ | ✅ → API |
| **Wear OS** | ❌ | ❌ | ❌ | ❌ (telefon üretir) |
| **watchOS** | ❌ | ❌ | ❌ | ❌ (iPhone üretir) |
| **API** | ❌ | ✅ (validation) | ✅ (server key) | ❌ |
| **Web** | ❌ | ❌ | ❌ | ❌ |

---

### 3.2 Payload (Inner) — Encrypted SOS Content

**Schema:** `schemas/sos-payload.schema.json`

| Alan | Tip | Üretir | Decrypt | Görür (Plaintext) | Not |
|------|-----|--------|---------|-------------------|-----|
| `sos_type` | enum | Android, iOS, Wear, Watch | API | API, Web | deprem, yangın, sel, yaralanma, diğer |
| `person_count` | int | Android, iOS, Wear, Watch | API | API, Web | 1-99 veya null |
| `note` | string | Android, iOS, Wear, Watch | API | API, Web | Max 200 karakter |
| `location.lat` | float | Android, iOS | API | API, Web | GPS koordinat |
| `location.lng` | float | Android, iOS | API | API, Web | GPS koordinat |
| `location.accuracy_meters` | float | Android, iOS | API | API, Web | GPS accuracy |
| `location.timestamp` | ISO8601 | Android, iOS | API | API, Web | GPS fix time |
| `device_id_hash` | SHA256 | Android, iOS, Wear, Watch | API | API (hash only) | Privacy: hash only |
| `language` | string | Android, iOS, Wear, Watch | API | API, Web | tr, en |

**Platform Mapping:**

| Platform | Üretir (Plaintext) | Encrypt | Decrypt | Görür (Decrypted) |
|----------|-------------------|---------|---------|-------------------|
| **Android (Afetzede)** | ✅ | ✅ (server public key) | ❌ | ❌ |
| **Android (Relay)** | ❌ | ❌ | ❌ | ❌ (encrypted blob) |
| **iOS (Afetzede)** | ✅ | ✅ (server public key) | ❌ | ❌ |
| **iOS (Relay)** | ❌ | ❌ | ❌ | ❌ (encrypted blob) |
| **Wear OS** | ✅ (companion telefona) | ❌ (telefon encrypt eder) | ❌ | ❌ |
| **watchOS** | ✅ (companion iPhone'a) | ❌ (iPhone encrypt eder) | ❌ | ❌ |
| **API** | ❌ | ❌ | ✅ (server private key) | ✅ |
| **Web** | ❌ | ❌ | ❌ | ✅ (API'den alır) |

**Privacy Guarantee:** Röle cihazlar **asla** inner payload'ı decrypt edemez.

---

### 3.3 ACK (Acknowledgment) — Status Updates

**Schema:** `schemas/ack-types.schema.json`

| ACK Tipi | Üretir | Tüketir | Transport | Anlamı |
|----------|--------|---------|-----------|--------|
| `PEER_RECEIVED` | Relay (BLE) | Afetzede | BLE GATT | Röle cihaz aldı |
| `SERVER_ACCEPTED` | API | Relay → Afetzede | BLE (relay iletir) | API kaydetti |
| `OPERATOR_SEEN` | API | Web → Afetzede (opsiyonel) | HTTP / SSE | Operatör açtı |
| `CASE_IN_PROGRESS` | API (operatör trigger) | Web | HTTP | Koordinasyon başladı |

**ACK JSON:**

```json
{
  "ack_type": "PEER_RECEIVED",
  "message_id": "uuid-v4",
  "timestamp": "ISO8601",
  "relay_id_hash": "sha256(relay_device_id)",
  "signature": "base64(HMAC)"
}
```

**Platform Mapping:**

| Platform | PEER_RECEIVED | SERVER_ACCEPTED | OPERATOR_SEEN | CASE_IN_PROGRESS |
|----------|---------------|-----------------|---------------|------------------|
| **Android (Afetzede)** | Tüketir (BLE) | Tüketir (BLE) | Tüketir (opsiyonel) | Tüketir (opsiyonel) |
| **Android (Relay)** | Üretir (BLE sign) | İletir (API → BLE) | ❌ | ❌ |
| **iOS (Afetzede)** | Tüketir (BLE) | Tüketir (BLE) | Tüketir (opsiyonel) | Tüketir (opsiyonel) |
| **iOS (Relay)** | Üretir (BLE sign) | İletir (API → BLE) | ❌ | ❌ |
| **Wear OS** | Tüketir (telefon üzerinden) | Tüketir (telefon üzerinden) | ❌ | ❌ |
| **watchOS** | Tüketir (iPhone üzerinden) | Tüketir (iPhone üzerinden) | ❌ | ❌ |
| **API** | ❌ | Üretir (HTTP response) | Üretir (panel event) | Üretir (operatör action) |
| **Web** | ❌ | ❌ | Üretir (panel open) | Üretir (durum değişikliği) |

---

### 3.4 API Requests — HTTP Endpoints

**Schema:** `schemas/api-requests.schema.json`

#### POST /v1/ingest

**Request Body:**

```json
{
  "envelope": { /* Envelope schema */ },
  "relay_info": {
    "relay_id_hash": "sha256(device_id)",
    "relay_timestamp": "ISO8601"
  }
}
```

**Response:**

```json
{
  "receipt": {
    "ack_type": "SERVER_ACCEPTED",
    "message_id": "uuid",
    "timestamp": "ISO8601",
    "signature": "base64(HMAC)"
  }
}
```

**Platform Mapping:**

| Platform | Üretir Request | Tüketir Response |
|----------|----------------|------------------|
| **Android (Relay)** | ✅ | ✅ |
| **iOS (Relay)** | ✅ | ✅ |
| **API** | ❌ | ✅ (üretir) |
| **Web** | ❌ | ❌ |

---

### 3.5 SSE Events — Operator Panel Feed

**Schema:** `schemas/sse-events.schema.json`

**Event Types:**

| Event | Üretir | Tüketir | Payload |
|-------|--------|---------|---------|
| `new_sos` | API | Web | `{ message_id, sos_type, person_count, location, ... }` |
| `operator_seen` | API (panel trigger) | Web | `{ message_id, operator_id, timestamp }` |
| `status_change` | API (operatör action) | Web | `{ message_id, new_status, old_status }` |

**Platform Mapping:**

| Platform | Üretir SSE | Tüketir SSE |
|----------|-----------|-------------|
| **Android** | ❌ | ❌ |
| **iOS** | ❌ | ❌ |
| **API** | ✅ | ❌ |
| **Web** | ❌ | ✅ |

---

### 3.6 Companion API — Wear/Watch → Phone

**Wear OS (Data Layer API):**

```kotlin
// Wear → Android Phone
dataClient.sendMessage(
  nodeId,
  "/sos/create",
  sosDataBytes
)
```

**watchOS (Watch Connectivity):**

```swift
// Watch → iPhone
WCSession.default.sendMessage(
  ["action": "sos_create", "data": sosDict],
  replyHandler: { reply in ... }
)
```

**Platform Mapping:**

| Platform | Üretir SOS | Telefon Tüketir | Telefon Üretir Envelope |
|----------|-----------|-----------------|-------------------------|
| **Wear OS** | ✅ (Data Layer) | Android tüketir | Android üretir |
| **watchOS** | ✅ (WCSession) | iPhone tüketir | iPhone üretir |

---

## 4. Serialization Format Matrix

| Sözleşme | BLE (Android ↔ iOS) | HTTP (Relay ↔ API) | Web (API ↔ Panel) | Companion (Watch ↔ Phone) |
|---------|---------------------|-------------------|-------------------|--------------------------|
| **Envelope** | CBOR | JSON | ❌ | ❌ |
| **Payload (encrypted)** | base64 (inner CBOR) | base64 (inner CBOR) | JSON | CBOR (local) |
| **ACK** | CBOR | JSON | JSON | CBOR (local) |
| **API Request** | ❌ | JSON | JSON | ❌ |
| **SSE Event** | ❌ | ❌ | JSON (text/event-stream) | ❌ |

**Neden CBOR (BLE):** Binary, JSON'dan küçük, BLE MTU 23-512 byte kısıtlamasına uyar  
**Neden JSON (HTTP/Web):** Human-readable, browser native, debug kolay

---

## 5. Platform Capability Matrix

| Özellik | Android | iOS | Wear OS | watchOS | API | Web |
|---------|---------|-----|---------|---------|-----|-----|
| **SOS Oluşturma** | ✅ | ✅ | ✅ (telefon üzerinden) | ✅ (iPhone üzerinden) | ❌ | ❌ |
| **BLE Relay** | ✅ | ✅ | ❌ (bağımsız değil) | ❌ (bağımsız değil) | ❌ | ❌ |
| **HTTP Upload** | ✅ (relay mode) | ✅ (relay mode) | ❌ (telefon yapar) | ❌ (iPhone yapar) | ✅ (receive) | ❌ |
| **E2E Encryption** | ✅ (public key) | ✅ (public key) | ❌ (telefon encrypt eder) | ❌ (iPhone encrypt eder) | ✅ (decrypt) | ❌ |
| **AI Sınıflandırma** | ❌ | ❌ | ❌ | ❌ | ✅ (worker) | ❌ |
| **Operatör UI** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 6. Sözleşme Değişikliği İzleme

**Version 1 (M0):**
- Envelope: `version: 1`
- Payload: İlk schema
- ACK: 4 tip (PEER_RECEIVED, SERVER_ACCEPTED, OPERATOR_SEEN, CASE_IN_PROGRESS)

**Future (Version 2):**
- Multihop routing metadata (hop chain, intermediate relay list)
- Mesh topology info (peer count, signal strength)

**Backward Compatibility:**
- Yeni opsiyonel alan eklemek: ✅ Safe
- Alan silmek veya tip değiştirmek: ❌ Major version bump

---

## 7. Test Coverage Matrix

| Sözleşme | Test Türü | Platform Kombinasyonu |
|----------|-----------|----------------------|
| **Envelope encode/decode** | Unit | Android ↔ iOS (CBOR roundtrip) |
| **Payload encryption** | Unit | Android/iOS encrypt → API decrypt |
| **ACK signature** | Unit | Relay sign → Afetzede verify |
| **API /v1/ingest** | E2E | Android → API → PostgreSQL |
| **SSE stream** | E2E | API → Web (EventSource) |
| **Companion SOS** | Integration | Wear → Android, Watch → iPhone |

**Golden Fixtures:** `packages/fixtures/protocol-v1/*.json`

---

## Referanslar

- **ADR-003:** Contracts ve fixtures
- **Master Plan §07:** Ortak şema ve çapraz dil sözleşmeleri
- **Master Plan §08:** BLE haberleşme v1 tasarımı
- **PRD §4:** Beş SOS durumu ve ACK eşlemesi
