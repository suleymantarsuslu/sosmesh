# ADR ↔ PRD/Master Tutarlılık Kontrolü

**Tarih:** 2026-10-29  
**Amaç:** ADR kararlarının PRD ve master plan ile çelişmediğini doğrulamak

---

## Kontrol Tablosu

| Konu | ADR | PRD/Master | Tutarlı mı? | Not |
|------|-----|------------|-------------|-----|
| **AI offline yolda çağrılmaz** | ADR-001 (SIFIR-İNTERNET), ADR-004 (server-only) | PRD §6 U3, master §20 | ✅ | A→B BLE yolunda Meta çağrısı yok; yalnızca API'de |
| **Röle içerik görmez** | ADR-003 (E2E encryption, inner payload) | PRD §3.2, master §09 | ✅ | Röle yalnızca routing metadata görür |
| **5 SOS durumu** | ADR-003 (ACK tipleri) | PRD §4 (PEER_RECEIVED, SERVER_ACCEPTED, ...) | ✅ | ACK kodları PRD ile eşleşiyor |
| **MODEL_API_KEY server-only** | ADR-004 (secrets boundary) | Master §20, PRD U3 | ✅ | Mobil/web client'ta API key yok |
| **iOS background sınırı** | ADR-002 (force-quit durur) | PRD §2.2, master §33 | ✅ | Force-quit sonrası relay garantisi yok; kullanıcıya açık |
| **Saat bağımsız mesh değil** | ADR-002 (companion API only) | PRD §6 U4, master §35-39 | ✅ | Wear/watch yalnızca telefona SOS gönderir |
| **Native BLE (RN değil)** | ADR-001 (native stack), ADR-002 | Master §12-16, §31-34 | ✅ | React Native BLE riski nedeniyle native tercih |
| **Yasak etiketler** | ❌ (ADR kapsamı dışı) | PRD §4.3 (Gönderildi, Teslim edildi, ...) | ✅ | ADR UI copy içermez; PRD'de tanımlı |
| **Monorepo pnpm** | ADR-001 (pnpm workspace) | Master §05 | ✅ | pnpm seçimi master'da önerilmiş |
| **NestJS + Next.js** | ADR-001 (stack) | Master §17, §21 | ✅ | Backend NestJS, panel Next.js |
| **JSON Schema → codegen** | ADR-003 (contracts) | Master §07 | ✅ | Tek kaynak sözleşme, üretilmiş tipler |
| **CBOR (BLE) / JSON (HTTP)** | ADR-003 (serialization) | Master §08 | ✅ | BLE binary efficiency, HTTP JSON debug |
| **SSE (operatör feed)** | ADR-001 (realtime), overview.md | Master §19 | ✅ | SSE + WebSocket fallback |
| **Deployment approval** | ADR-004 (production guard) | Master §54 | ✅ | Prod deploy kullanıcı onayı |

---

## Çelişki Bulunan Konular

**Hiçbiri.** Tüm ADR kararları PRD ve master plan ile tutarlı.

---

## Ek Doğrulamalar

### 1. Offline Yol Bağımlılığı

**ADR-001 (overview.md):** "SIFIR-İNTERNET Yolu" diyagramı  
**PRD U1-U2:** Afetzede SOS + Röle transfer  
**Master §08, §10:** BLE + Outbox  

**Doğrulama:**
```
A (offline SOS) → BLE → B (relay) → Outbox (local)
```

✅ **Meta API bağımlılığı yok**  
✅ **Internet bağımlılığı yok** (B'de internet yoksa outbox'ta bekler)

---

### 2. Röle Gizliliği

**ADR-003 (contract-matrix):** "Röle yalnızca outer envelope görür"  
**PRD §3.2:** "Röle şifreli payload'ı görmez"  
**Master §09:** "Kriptografi ve yerel mahremiyet"

**Doğrulama:**
```
Outer Envelope (plaintext): message_id, hop_count, TTL → Relay GÖRÜR
Inner Payload (encrypted): SOS metin, konum, kişi → Relay GÖRMEZ
```

✅ **Privacy guarantee korunuyor**

---

### 3. ACK Anlamları

| ACK | ADR-003 | PRD §4 | Master §08 |
|-----|---------|--------|------------|
| PEER_RECEIVED | Relay sign | "Yakındaki cihaz aldı" | BLE peer ack |
| SERVER_ACCEPTED | API receipt | "Sunucuya ulaştı" | HTTP 2xx |
| OPERATOR_SEEN | Panel event | "Operatör gördü" | Panel open |
| CASE_IN_PROGRESS | Operator action | "Vaka işlemde" | Manuel durum |

✅ **Tüm ACK tipleri tutarlı**

---

### 4. Platform Kısıtlamaları

| Kısıt | ADR-002 | PRD §2.2 | Master |
|-------|---------|----------|--------|
| iOS force-quit durur | ✅ Belirtildi | ✅ Kapsam dışı | §33 |
| Android Doze | ✅ Belirtildi | ✅ OEM kısıtlamaları | §30 |
| Saat bağımsız mesh yok | ✅ Companion only | ✅ U4 tanımı | §35-39 |

✅ **Tüm kısıtlar tutarlı**

---

## Sonuç

**ADR ↔ PRD/Master tutarlılık: ✅ PASS**

Tüm mimari kararlar PRD ve master plan ile uyumlu. Hiçbir çelişki bulunamadı.

---

## İmza

Kontrol Eden: Cursor Agent (ADIM 03)  
Tarih: 2026-10-29  
Commit: (pending)
