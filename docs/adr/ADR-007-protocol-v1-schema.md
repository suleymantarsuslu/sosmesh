# ADR-007: Protocol V1 Schema and Cross-Language Contracts

**Durum:** Kabul Edildi  
**Tarih:** 2026-10-29  
**Karar Veren:** SOSMesh Ekip  
**Bağlantı:** ADIM 07, ADR-003 (Fixtures)

## Bağlam

SOSMesh uygulaması Android, iOS, Watch, Web ve API arasında emergency SOS mesajları iletir. Farklı platformlar arasında veri bütünlüğü ve güvenlik için tek bir kaynak şema tanımı gereklidir.

### Kritik Gereksinimler

1. **ACK Seviyeleri Ayrımı**: Peer ACK (mesh hop/cihazdan cihaza) ≠ Sunucu ACK ≠ Operatör Okundu
2. **Gizlilik**: Röle node'ları hassas SOS metnini görmez (şifreli/opak payload + açık zarf ayrımı)
3. **Cross-Platform**: TypeScript, Kotlin, Swift eşdeğer deserialization

## Karar

### 1. JSON Schema ile Tanım

- `packages/contracts/schemas/common.schema.json`: Ortak tipler (timestamp, UUID, accuracy, ACK levels, errors)
- `packages/contracts/schemas/sos-message.schema.json`: SOS mesaj yapısı
- `docs/api/openapi.yaml`: OpenAPI 3.1 ile API contract

### 2. ACK Seviyeleri

```
DEVICE_STORED      → Cihazda kaydedildi
PEER_RECEIVED      → Yakın mesh cihaz aldı (peer ACK)
RELAY_FORWARDED    → Röle iletti
SERVER_RECEIVED    → Sunucu aldı (server ACK)
OPERATOR_VIEWED    → Operatör gördü (operator read)
INCIDENT_OPENED    → Vaka işleme alındı
```

### 3. Mesaj Yapısı

```json
{
  "version": 1,
  "id": "uuid",
  "envelope": {
    "timestamp": "ISO8601",
    "location": { "latitude": 0, "longitude": 0, "accuracy": 0 },
    "priority": 1,
    "ackLevel": "DEVICE_STORED",
    "relayCount": 0
  },
  "encryptedPayload": "BASE64_ENCRYPTED_TEXT",
  "signature": "INTEGRITY_SIGNATURE"
}
```

**Envelope (Açık)**: Röle ve routing için görülebilir metadata  
**encryptedPayload (Şifreli)**: Hassas SOS metni, röle node'ları göremez

### 4. Backward Compatibility

- **version: 1**: Protocol versiyonu açıkça belirtilir
- **Unknown Field Strategy**: `ignoreUnknownKeys = true` (Kotlin), AJV `additionalProperties: false` (TS), varsayılan Codable (Swift)
- **Migration**: Version değişikliğinde yeni schema dosyası (`v2.schema.json`) eklenir, eski desteklenir

### 5. Cross-Language Testing

- **TypeScript**: AJV + Vitest
- **Kotlin**: kotlinx.serialization + JUnit5
- **Swift**: Codable + XCTest (Linux toolchain)

Canonical JSON karşılaştırması ile eşdeğerlik doğrulanır.

## Sonuçlar

### Pozitif

- Tek kaynak schema tanımı (JSON Schema)
- Güvenlik: Şifreli payload + açık zarf ayrımı
- ACK seviyeleri net tanımlanmış
- Cross-platform roundtrip test coverage

### Negatif

- JSON Schema maintenance overhead
- Multi-language test CI süresi artar

## Alternatifler

1. **Protobuf**: Binary serialization, ama JSON okunabilirliği ve web/debugging kolaylığı kaybedilir
2. **GraphQL Schema**: API için uygun ama mesh cihaz-cihaz iletimi için overhead

## Referanslar

- ADR-003: Contracts and Fixtures
- OpenAPI 3.1: JSON Schema integration
- kotlinx.serialization: Kotlin multiplatform support
