# ADR-009: Kriptografi ve Yerel Mahremiyet

**Durum:** Kabul Edildi  
**Tarih:** 2026-10-29  
**Karar Veren:** SOSMesh Ekip  
**Bağlantı:** ADIM 09, ADR-007 (Protocol V1 Schema), ADR-008 (BLE V1)

## Bağlam

SOSMesh'te **rölelerin (relay node) hassas SOS içeriğini okuyamaması** kritik bir gizlilik gereksinimidir. ADR-007'de belirlenen `envelope` (açık metadata) + `encryptedPayload` (opak şifreli içerik) ayrımı uygulanmalı.

### Gereksinimler

1. **Röle Gizliliği**: Röle node SOS metnini, GPS detaylarını, kişi bilgisini göremez
2. **Sunucu Doğrulama**: Sunucu payload'ı çözüp doğrular (AI analizi için)
3. **Metadata Bütünlük**: Envelope metadata ile ciphertext bağlı (AAD)
4. **Nonce Tekrarı Yok**: Aynı key+nonce ile iki şifreleme yapılmaz
5. **Yerel Anahtar Güvenliği**: Android Keystore, iOS Keychain koruması
6. **Dev/Prod Ayrımı**: Geliştirme anahtarı production'da reddedilir
7. **Log Hijyeni**: Plaintext, key, nonce, PII loglanmaz
8. **Hata Güvenliği**: Key eksik/compromised durumda SOS engellenmez, 112 uyarısı korunur

## Karar

### 1. Kripto Tasarımı: X25519 + HKDF + ChaCha20-Poly1305

**Seçim:** Hybrid encryption (ECIES pattern) with authenticated encryption

**Bileşenler:**
- **Key Agreement:** X25519 (elliptic curve Diffie-Hellman)
- **Key Derivation:** HKDF-SHA256
- **AEAD:** ChaCha20-Poly1305

**Alternatif:** AES-256-GCM (hardware AES support için fallback)

### 2. Anahtar Mimarisi

```
Server Long-term Key Pair:
  - Public Key (server_public.key): İstemcilere dağıtılır (app bundle, config)
  - Private Key (server_private.key): YALNIZCA sunucuda, HSM/KMS korumalı

İstemci Ephemeral Key Pair (her SOS için):
  - Ephemeral Private Key: Şifreleme sonrası silinir
  - Ephemeral Public Key: Ciphertext ile birlikte gönderilir

Shared Secret Derivation:
  HKDF-SHA256(
    ikm: ECDH(ephemeral_private, server_public),
    salt: nonce,
    info: "SOSMesh-v1-payload-encryption"
  ) → encryption_key (32 bytes) + auth_key (32 bytes)
```

### 3. Şifreleme Protokolü

**Envelope:**
```json
{
  "version": 1,
  "id": "uuid",
  "envelope": {
    "timestamp": "ISO8601",
    "location": {"latitude": 0, "longitude": 0, "accuracy": 0},
    "priority": 1,
    "ackLevel": "DEVICE_STORED",
    "relayCount": 0
  },
  "encryptedPayload": {
    "keyId": "prod-2026-10",
    "ephemeralPublicKey": "BASE64",
    "nonce": "BASE64_24_BYTES",
    "ciphertext": "BASE64",
    "tag": "BASE64_16_BYTES"
  },
  "signature": "ENVELOPE_DIGEST_SHA256"
}
```

**Plaintext Payload (şifrelenmeden önce):**
```json
{
  "sosText": "Kullanıcının acil durum mesajı",
  "category": "medical",
  "personsCount": 3,
  "injuries": true,
  "userLanguage": "tr"
}
```

**Şifreleme Adımları:**
1. Ephemeral key pair oluştur
2. ECDH ile shared secret hesapla
3. HKDF ile encryption_key + auth_key türet
4. Random 192-bit nonce üret
5. ChaCha20-Poly1305 ile şifrele:
   - Plaintext: JSON.stringify(payload)
   - AAD: JSON.stringify(envelope) (metadata bütünlüğü)
   - Key: encryption_key
   - Nonce: nonce
6. Tag doğrula (16 bytes)
7. Ephemeral private key'i güvenli sil

### 4. Nonce Politikası

**Nonce Boyutu:** 192-bit (24 bytes) rastgele  
**Üretim:** Kriptografik güvenli PRNG (crypto.randomBytes, SecureRandom, SecRandomCopyBytes)  
**Tekrar Kontrolü:** Test ortamında 100k şifreleme → collision kontrolü  
**Garantisi:** 192-bit ile 2^96 şifreleme sonrası collision probability < 2^-32

### 5. Key Management

**Key ID Namespace:**
```
dev-test-001        → Geliştirme (hard-coded test key, TEST ONLY etiketli)
staging-2026-10     → Staging environment
prod-2026-10        → Production (bundle/config'de public key, private server-only)
```

**Key Rotation:**
- Yeni key ID ile yeni mesajlar şifrelenir
- Eski key ID'ler 90 gün sunucuda tutulur (decrypt için)
- Client config update ile yeni public key dağıtılır

**Compromised Key:**
- Key ID invalidate edilir
- Yeni key ID zorlanır (app update)
- Kullanıcıya "Güvenlik güncellemesi gerekli" bildirimi

### 6. Yerel Anahtar Güvenliği

**Android Keystore:**
```kotlin
interface KeystoreAdapter {
    fun storeKey(keyId: String, keyData: ByteArray)
    fun retrieveKey(keyId: String): ByteArray?
    fun deleteKey(keyId: String)
    fun listKeys(): List<String>
}

// Implementation: Android Keystore API
// - Hardware-backed key storage (StrongBox Keymaster)
// - setUserAuthenticationRequired(false) for SOS emergency access
// - setUnlockedDeviceRequired(true)
```

**CI Test:** Mock KeystoreAdapter (in-memory), NOT_TESTED label for real Keystore

**iOS Keychain:**
```swift
protocol KeychainAdapter {
    func storeKey(keyId: String, keyData: Data) throws
    func retrieveKey(keyId: String) throws -> Data?
    func deleteKey(keyId: String) throws
    func listKeys() throws -> [String]
}

// Implementation: Keychain Services API
// - kSecAttrAccessibleWhenUnlockedThisDeviceOnly
// - kSecAttrSynchronizable: false (no iCloud sync for SOS keys)
```

**CI Test:** Mock KeychainAdapter, NOT_TESTED label for real Keychain

### 7. Error Handling

**Error Codes:**
```typescript
enum CryptoError {
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  KEY_EXPIRED = 'KEY_EXPIRED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_TAG = 'INVALID_TAG',
  NONCE_COLLISION = 'NONCE_COLLISION',
  KEYSTORE_UNAVAILABLE = 'KEYSTORE_UNAVAILABLE'
}
```

**Kullanıcı Mesajları (TR/EN):**
```json
{
  "KEY_NOT_FOUND": {
    "tr": "Güvenlik anahtarı bulunamadı. SOS mesajınız şifrelenmeden gönderilecek. Acil durumlar için 112'yi arayın.",
    "en": "Security key not found. Your SOS will be sent unencrypted. For emergencies, call 112."
  },
  "KEYSTORE_UNAVAILABLE": {
    "tr": "Cihaz güvenliği kullanılamıyor. Mesajınız geçici anahtarla korunacak.",
    "en": "Device security unavailable. Your message will use temporary protection."
  }
}
```

**Davranış:**
- Key eksikse → Fallback: şifrelenmeden gönder + kullanıcı uyarısı
- Decryption fail → Server: ham envelope kaydet, operator'e uyar
- **112 uyarısı her durumda gösterilir** (kripto hatası SOS'u engellmez)

### 8. Dev vs Prod Key Ayrımı

**Test Key (dev-test-001):**
```
# packages/contracts/crypto-test-vectors/test-keys.json
{
  "WARNING": "TEST ONLY - DO NOT USE IN PRODUCTION",
  "keyId": "dev-test-001",
  "serverPublicKey": "BASE64_X25519_PUBLIC_KEY",
  "serverPrivateKey": "BASE64_X25519_PRIVATE_KEY",
  "purpose": "Cross-language test vector validation"
}
```

**Secret Scanner Allowlist:**
```yaml
# .github/secret-scan-allowlist.yml
paths:
  - path: packages/contracts/crypto-test-vectors/**
    reason: "Contains TEST-ONLY encryption keys with explicit WARNING labels"
    patterns:
      - "dev-test-001"
    reviewer: "@security-team"
```

**Production Key:**
```
# apps/api/.env.production (NEVER in repo)
SOSMESH_SERVER_PRIVATE_KEY=<KMS_ARN or HSM reference>

# apps/mobile/config/prod.json (public key only)
{
  "crypto": {
    "keyId": "prod-2026-10",
    "serverPublicKey": "BASE64_X25519_PUBLIC_KEY"
  }
}
```

**Prod Rejection Test:**
```typescript
it('should reject dev key in production config', () => {
  const config = { keyId: 'dev-test-001', ... };
  expect(() => validateCryptoConfig(config, 'production'))
    .toThrow('Dev key not allowed in production');
});
```

### 9. Log Hijyeni

**Redaction Policy:**
```typescript
// Logging helper
function sanitizeForLog(obj: any): any {
  const redacted = { ...obj };
  delete redacted.sosText;
  delete redacted.plaintext;
  delete redacted.serverPrivateKey;
  delete redacted.ephemeralPrivateKey;
  delete redacted.sharedSecret;
  if (redacted.location) {
    redacted.location = { accuracy: redacted.location.accuracy }; // GPS redacted
  }
  if (redacted.nonce && redacted.encryptionKey) {
    // nonce+key pair = sensitive
    delete redacted.encryptionKey;
  }
  return redacted;
}
```

**Log Example:**
```
[INFO] SOS encrypted: id=a1b2c3, keyId=prod-2026-10, envelopeSize=245, ciphertextSize=512
[ERROR] Decryption failed: id=a1b2c3, keyId=prod-2026-10, error=INVALID_TAG
```

**Redaction Test:**
```typescript
it('should not log plaintext SOS content', () => {
  const logs = captureConsoleLogs(() => encryptSOS(payload));
  expect(logs.join()).not.toContain('Kullanıcının acil durum mesajı');
  expect(logs.join()).not.toContain('serverPrivateKey');
});
```

### 10. Mutation Testing (Tamper Detection)

**Hedef:** Hiçbir tamper (ciphertext, tag, AAD, nonce, keyId değişikliği) kabul edilmez

**Test Planı:**
1. Geçerli ciphertext oluştur
2. Doğrulama testini çalıştır → PASS
3. Kodu geçici olarak sabotaj et (tag validation'ı devre dışı bırak)
4. Aynı tampering testini çalıştır → FAIL (test kırmızı olmalı)
5. Sabotajı geri al
6. Testleri tekrar çalıştır → PASS

**Mutation Test (CI'da ÇALIŞTIRILMAZ, manuel doğrulama):**
```bash
# Geçici mutation
git apply mutation-disable-tag-check.patch
pnpm test crypto.tamper.test.ts  # MUST BE RED (exit code != 0)
git apply -R mutation-disable-tag-check.patch
pnpm test crypto.tamper.test.ts  # MUST BE GREEN
```

## Sonuçlar

### Pozitif
- Röle node hassas içerik göremez (E2E privacy)
- Metadata bütünlüğü (AAD binding)
- Nonce tekrarı garantisi
- Dev/prod key ayrımı zorlanır
- Hardware-backed key storage (Android/iOS)
- Log PII sızdırımı yok

### Negatif
- Kripto overhead (~200 bytes ciphertext + ephemeral key)
- Key rotation manuel deploy gerektirir
- Fallback unencrypted mode gerekli (key unavailable)

### Riskler
- Prod key leak → tüm geçmiş mesajlar decrypt edilebilir
  - **Mitigasyon:** Server private key HSM/KMS'te, rotate policy
- Quantum resistance yok (X25519)
  - **Mitigasyon:** Post-quantum algos (Kyber) v2'de değerlendirilir

## Alternatifler

1. **TLS-only (no E2E):** Röle node içerik okur → Reddedildi
2. **AES-GCM:** Hardware support iyi ama X25519 key agreement yok → Fallback olarak kullanılır
3. **libsodium sealed box:** Daha basit API ama AAD binding yok → Reddedildi
4. **HPKE (RFC 9180):** Modern standart ama library support sınırlı → v2 için değerlendir

## Referanslar

- [ECIES (Elliptic Curve Integrated Encryption Scheme)](https://en.wikipedia.org/wiki/Integrated_Encryption_Scheme)
- [RFC 7748: X25519 Key Agreement](https://datatracker.ietf.org/doc/html/rfc7748)
- [RFC 5869: HKDF](https://datatracker.ietf.org/doc/html/rfc5869)
- [RFC 8439: ChaCha20-Poly1305](https://datatracker.ietf.org/doc/html/rfc8439)
- [Android Keystore System](https://developer.android.com/training/articles/keystore)
- [iOS Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
