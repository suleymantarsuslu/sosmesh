# ADR-003: Contracts ve Fixtures

**Durum:** Kabul Edildi  
**Tarih:** 2026-10-29  
**Kapsam:** ADIM 03 (Hackathon / Çekirdek)  
**İlgili:** ADR-001 (stack), ADIM 07 (ortak şema), ADIM 08 (BLE protokol)

---

## Bağlam

SOSMesh çapraz platform mesajlaşma gerektirir: Android ↔ iOS ↔ API ↔ Web. Tek kaynak sözleşme (JSON Schema) ile üretilmiş tipler compile-time güvenlik sağlar. BLE üzerinde binary serialization (CBOR) pil tasarrufu için gereklidir.

**Gereksinimler:**
- Tek kaynak sözleşme (platform-agnostic)
- Üretilmiş tipler (TypeScript, Kotlin, Swift)
- Binary serialization (BLE için)
- Sürüm uyumluluğu (backward compatibility)
- Test fixture'ları (encode/decode roundtrip)

---

## Karar

### 1. Contracts Package

**Konum:** `packages/contracts`

**İçerik:**
- `schemas/*.json` — JSON Schema dosyaları
- `openapi.yaml` — API contract (üretilmiş)
- `codegen/` — Tip üretim script'leri
- `dist/` — Üretilmiş tipler (TypeScript, Kotlin, Swift)

**JSON Schema → Üretilmiş Tipler:**

```
packages/contracts/
├── schemas/
│   ├── sos-envelope.schema.json       # BLE transport envelope
│   ├── sos-payload.schema.json        # Şifreli inner payload
│   ├── ack-types.schema.json          # PEER_RECEIVED, SERVER_ACCEPTED, ...
│   ├── api-requests.schema.json       # /v1/ingest POST body
│   ├── api-responses.schema.json      # API receipts, errors
│   └── ai-analysis.schema.json        # Meta AI JSON output
├── codegen/
│   ├── generate-typescript.sh         # json-schema-to-typescript
│   ├── generate-kotlin.sh             # jsonschema2poko
│   └── generate-swift.sh              # quicktype --lang swift
├── dist/
│   ├── typescript/
│   │   └── index.d.ts                 # Üretilmiş TS tipleri
│   ├── kotlin/
│   │   └── com/sosmesh/contracts/     # Kotlin data class
│   └── swift/
│       └── Contracts.swift            # Swift Codable struct
└── package.json                        # pnpm workspace package
```

---

### 2. Serialization Formatları

#### HTTP / WebSocket (API ↔ Web)

**Format:** JSON  
**Neden:** 
- Browser native support
- Debug kolay (human-readable)
- HTTP body standart
- OpenAPI Swagger UI uyumlu

#### BLE (Android ↔ iOS)

**Format:** CBOR (Concise Binary Object Representation)  
**Neden:**
- **Boyut:** JSON'dan %30-50 daha küçük (BLE MTU 23-512 byte)
- **Parse hızı:** Binary, string parse yok
- **Tip koruması:** Int/Float/Bool native encoding
- **Kütüphane desteği:** Kotlin (`kotlinx.serialization-cbor`), Swift (`SwiftCBOR`)

**Alternatif:** Protobuf  
**Neden Reddedildi:** CBOR daha basit, JSON'a yakın şema, web uyumlu (CBOR ↔ JSON dönüşümü basit)

---

### 3. Envelope Yapısı (BLE)

**Outer Envelope (Plaintext):**

```json
{
  "version": 1,
  "message_id": "uuid-v4",
  "created_at": "ISO8601",
  "ttl_seconds": 86400,
  "hop_count": 1,
  "max_hops": 5,
  "inner_payload_encrypted": "base64(AES-GCM-ciphertext)",
  "inner_payload_nonce": "base64(nonce)",
  "envelope_signature": "base64(HMAC-SHA256)"
}
```

**Inner Payload (Encrypted):**

```json
{
  "sos_type": "deprem | yangın | sel | yaralanma | diğer",
  "person_count": 3,
  "note": "Bina çöktü, 2. kat",
  "location": {
    "lat": 39.925533,
    "lng": 32.866287,
    "accuracy_meters": 10.5,
    "timestamp": "ISO8601"
  },
  "device_id_hash": "sha256(device_id)",
  "language": "tr"
}
```

**Neden İki Katman:**
- **Outer (routing metadata):** Röle görebilir (hop_count, TTL)
- **Inner (sensitive data):** Yalnızca server decrypt eder, röle görmez

---

### 4. ACK Tipleri

| ACK Kod | Anlamı | Gönderen | Alıcı |
|---------|--------|----------|-------|
| `PEER_RECEIVED` | Yakındaki cihaz aldı | Relay (BLE) | Afetzede |
| `SERVER_ACCEPTED` | API aldı, kayıt oluşturdu | API | Relay |
| `OPERATOR_SEEN` | Operatör panelde açtı | Panel | API |
| `CASE_IN_PROGRESS` | Koordinasyon başladı | Operatör | API |

**JSON Schema:**

```json
{
  "ack_type": "PEER_RECEIVED",
  "message_id": "uuid-v4",
  "timestamp": "ISO8601",
  "relay_id_hash": "sha256(relay_device_id)",
  "signature": "base64(HMAC)"
}
```

---

### 5. Fixtures Package

**Konum:** `packages/fixtures`

**İçerik:**
- `protocol-v1/*.json` — Golden test vectors
- `encode-decode-test.ts` — Roundtrip test
- `negative-fixtures.json` — Bozuk paket, eksik alan, invalid enum
- `unicode-fixtures.json` — Türkçe/Arapça/emoji test

**Örnek Fixture:**

```json
{
  "name": "valid-deprem-3-kisi",
  "envelope": { ... },
  "inner_payload": { ... },
  "expected_cbor_bytes": "base64(...)",
  "expected_json": { ... },
  "test_assertions": [
    "encode(json) == cbor_bytes",
    "decode(cbor_bytes) == json",
    "schema_valid(json)"
  ]
}
```

---

### 6. Sürümleme Politikası

**Envelope Version:** `version: 1` (outer envelope'da)

**Backward Compatibility Kuralları:**

1. **Yeni alan eklemek:** ✅ Opsiyonel alan eklenebilir (eski client görmezden gelir)
2. **Alan silmek:** ❌ Major version bump (v1 → v2)
3. **Alan tipi değiştirmek:** ❌ Major version bump
4. **Enum değeri eklemek:** ✅ Eski client `diğer` olarak işler
5. **Zorunlu alan eklemek:** ❌ Major version bump

**Version Negotiation (BLE):**
- Handshake sırasında her cihaz desteklediği version'ları bildirir
- Ortak en yüksek version kullanılır
- Version uyumsuzluğu → bağlantı reddedilir, log kaydedilir

**Migration Path:**
- `version: 1` → M0, M1
- `version: 2` → Gelecekte (örn. multihop routing metadata eklenir)

---

## Alternatifler

### Protobuf

**Avantajlar:**
- Binary, CBOR'dan daha küçük
- Strong typing, code generation

**Dezavantajlar:**
- Web browser desteği zayıf (protobuf.js büyük)
- Debug zor (binary inspector gerektirir)
- JSON ↔ Protobuf mapping karmaşık

**Sonuç:** CBOR (web uyumlu, debug kolay)

### GraphQL

**Avantajlar:**
- Tip sistemi güçlü
- Query flexibility

**Dezavantajlar:**
- BLE üzerinde kullanışsız (query dili HTTP-centric)
- M0 için overkill

**Sonuç:** JSON Schema + REST (basitlik)

---

## Sonuçlar

### Pozitif
- **Tek kaynak sözleşme:** JSON Schema tüm platformlar için single source of truth
- **Compile-time güvenlik:** Üretilmiş tipler syntax hatasını önler
- **Binary efficiency:** CBOR BLE MTU kısıtlamalarına uyar
- **Test coverage:** Golden fixtures roundtrip test sağlar

### Negatif
- **Codegen bağımlılığı:** JSON Schema değiştiğinde tüm platformlar yeniden üretilmeli (CI otomatik yapmalı)
- **CBOR library:** Her platform ayrı library (Kotlin, Swift) — encoding farkları olabilir
- **Version migration:** V1 → V2 geçişinde eski client'lar çalışmaz durabilir

### Riskler
- **CBOR encoding farklılıkları:** Kotlin ve Swift CBOR implementasyonları farklı map order kullanabilir → SHA digest uyuşmazlığı
  - **Mitigation:** Canonical CBOR (RFC 8949), deterministik encoding test
- **Schema drift:** Manuel JSON Schema güncellemesi tip hatasına yol açabilir
  - **Mitigation:** CI'da schema validation, fixture roundtrip test

---

## Karar Kriterleri

| Kriter | JSON Schema + CBOR | Protobuf | GraphQL |
|--------|--------------------|----------|---------|
| **Web uyumluluğu** | ✅ JSON native | ⚠️ protobuf.js büyük | ✅ Apollo client |
| **BLE efficiency** | ✅ CBOR küçük | ✅ Protobuf küçük | ❌ Query overhead |
| **Debug kolaylığı** | ✅ JSON human-readable | ❌ Binary inspector | ✅ GraphiQL |
| **Ekosistem** | ✅ JSON Schema tools | ⚠️ Protoc setup | ⚠️ M0 için karmaşık |
| **Type safety** | ✅ Codegen | ✅ Codegen | ✅ Codegen |

**Sonuç:** JSON Schema + CBOR (BLE + web uyumlu, debug kolay)

---

## İlgili Kararlar

- **ADR-001:** Stack (JSON Schema → TypeScript/Kotlin/Swift)
- **ADR-002:** Native mobile (CBOR library seçimi)
- **ADR-004:** Secrets (inner_payload encryption key)

---

## Referanslar

- Master Plan §07: Ortak şema ve çapraz dil sözleşmeleri
- Master Plan §08: BLE haberleşme v1 tasarımı
- Master Plan §09: Kriptografi ve yerel mahremiyet
- RFC 8949: Concise Binary Object Representation (CBOR)
- JSON Schema Specification: https://json-schema.org/
