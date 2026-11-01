# ADR-013: Retention, Erasure ve Export

**Status**: Accepted (teknik) — yasal uygunluk `NOT_TESTED`  
**Date**: 2026-11-01  
**Related**: ADR-009 (crypto), ADIM 44 data map

## Context

SOS mesajları hassas konum ve sağlık bağlamı taşıyabilir. Saklama süresi ürün ve hukuk kararı gerektirir; kodda keyfi varsayılan gün sayısı taşımak yanlış güven oluşturur.

## Decision

### Konfigürasyon

| Değişken | Anlam | Varsayılan |
| --- | --- | --- |
| `RETENTION_JOB_ENABLED` | Arka plan / admin tetiklemeli purge | `false` |
| `RETENTION_SOS_MESSAGE_MAX_AGE_SECONDS` | Mesaj `receivedAt` eşiği | **Tanımsız (boş)** — prod’da kullanıcı/onay olmadan set edilmez |

**Kural:** Repoda veya dokümanda “7 gün” gibi gerçek süre **uydurulmaz**. Operatör dokümantasyonu yalnızca değişken adını ve onay gereksinimini listeler.

### Silme (erase)

- Yetki: `ADMIN`, `COORDINATOR` (tenant scope).
- Uç: `POST /v1/operator/privacy/incidents/:incidentId/erase`
- Incident cascade ile ilişkili kayıtlar silinir; öncesinde `PRIVACY_ERASE_REQUEST` audit (redakte).

### Export

- Yetki: `ADMIN`, `COORDINATOR`.
- Uç: `GET /v1/operator/privacy/incidents/:incidentId/export`
- Şifreli blob içeriği export edilmez; yalnızca `hasEncryptedPayload` bayrağı.

### Retention job

- Servis: `PrivacyRetentionService.purgeExpiredRecords`
- Tetik: `POST /v1/operator/privacy/retention/run` (ADMIN) veya harici scheduler (M1).

### Audit redaksiyonu

Privacy ve metadata düzeltme audit kayıtları `redactAuditDetails` ile yazılır/okunur.

## Consequences

- Prod deploy checklist’ine retention env onay maddesi eklenmeli (ADIM 56).
- Hukuki retention süresi netleşene kadar job kapalı kalır.
