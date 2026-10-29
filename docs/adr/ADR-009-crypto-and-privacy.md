# ADR-009: Cryptography and Local Privacy

**Status**: Accepted  
**Date**: 2026-10-29  
**Deciders**: Technical Team  
**Related**: [ADR-007 (Contracts)](ADR-007-contracts.md), [ADR-008 (BLE Protocol)](ADR-008-ble-v1-protocol.md)

---

## Context

SOSMesh must encrypt SOS payloads so that **relays cannot read the content** while still being able to forward encrypted data to the server. Emergency messages contain sensitive personal information (location, medical details, names) that must be protected end-to-end.

### Requirements
1. **End-to-End Encryption**: Only the server can decrypt SOS messages
2. **Authenticated Encryption**: Envelope metadata must be cryptographically bound to ciphertext
3. **Cross-Platform**: TypeScript, Kotlin (Android), and Swift (iOS) must interoperate
4. **Nonce Uniqueness**: No IV/nonce reuse across billions of encryptions
5. **Key Rotation**: Support multiple active server keys with graceful transition
6. **Auditable**: Battle-tested cryptographic primitives only

---

## Decision

### Algorithm: X25519 + HKDF-SHA256 + IETF ChaCha20-Poly1305

#### 1. **Key Agreement: X25519 (Curve25519 ECDH)**
- **Ephemeral-Static ECDH**: Client generates ephemeral X25519 keypair per message
- **Server Public Key Pinned**: Known server public key embedded in app bundle
- **Shared Secret**: `sharedSecret = X25519(ephemeralPrivate, serverPublic)`
- **Forward Secrecy**: Each message uses fresh ephemeral key

#### 2. **Key Derivation: HKDF-SHA256**
```
encryptionKey = HKDF-SHA256(
  ikm = sharedSecret,      // 32 bytes from X25519
  salt = nonce,            // 12-byte random nonce
  info = "SOSMesh-v1-{keyId}-encryption",
  outputLength = 32        // 256-bit ChaCha20 key
)
```

**Rationale**:
- **Salt = Nonce**: Binds key derivation to unique message context
- **Info String**: Domain separation prevents cross-protocol attacks; includes `keyId` for multi-key support

#### 3. **Authenticated Encryption: IETF ChaCha20-Poly1305**
- **Cipher**: ChaCha20 stream cipher (RFC 8439)
- **MAC**: Poly1305 authentication tag (128-bit)
- **Nonce**: 96-bit (12-byte) random, unique per message
- **AAD**: Associated Authenticated Data binding envelope metadata

**AAD Construction**:
```json
{
  "envelope": {
    "timestamp": "2026-10-29T20:00:00Z",
    "location": {"latitude": 39.9334, "longitude": 32.8597, "accuracy": 10},
    "priority": 1
  },
  "keyId": "prod-2026-Q4-001",
  "protocol": "v1"
}
```
- **Canonical JSON**: Sorted keys, deterministic serialization (ADR-007)
- **Binds Metadata**: Tampering with timestamp/location/priority invalidates tag

---

## Implementation

### Libraries (Battle-Tested Only)

| Platform | Library | Rationale |
|----------|---------|-----------|
| **TypeScript** | `@noble/curves`, `@noble/hashes`, `@noble/ciphers` | Audited, pure JS, no native deps |
| **Kotlin** | BouncyCastle (`bcprov-jdk18on:1.77`) | Industry standard, Android Keystore compatible |
| **Swift** | `swift-crypto` (Apple CryptoKit) | Native, hardware-accelerated (Secure Enclave) |

**Rejected Alternatives**:
- ❌ **TweetNaCl**: No AAD support in `secretbox` (XSalsa20-Poly1305)
- ❌ **AES-GCM**: Hardware acceleration unreliable on all Android devices
- ❌ **Custom Crypto**: High risk of implementation flaws

### Key Storage

#### Development
- **Test Keys**: `packages/contracts/crypto-test-vectors/test-keys.json`
- **Marked**: `⚠️ TEST ONLY - DO NOT USE IN PRODUCTION ⚠️`
- **Validation**: Production config rejects `dev-test-*` keyIds

#### Production
- **Android**: Android Keystore System (hardware-backed when available)
- **iOS**: Keychain Services + Secure Enclave
- **Server**: HSM or KMS (AWS KMS, Google Cloud KMS, Azure Key Vault)

**Key Rotation**:
- **Frequency**: Every 90 days (quarterly)
- **Grace Period**: 30 days (old key remains valid for decryption)
- **Active Keys**: Multiple `keyId` supported simultaneously

---

## Security Properties

### Guarantees
1. **Confidentiality**: Only server with private key can decrypt
2. **Integrity**: Any tampering with ciphertext or metadata detected
3. **Authenticity**: Server verifies message originated from client with valid ephemeral key
4. **Forward Secrecy**: Compromising server key does not decrypt past messages (ephemeral keys discarded)

### Non-Goals
- **Post-Quantum Security**: X25519 vulnerable to quantum computers (migration planned post-2030)
- **Sender Authentication**: No proof of specific device identity (by design for privacy)
- **Multi-Recipient**: Single server public key only (no group encryption)

---

## Testing & Validation

### Cross-Language Golden Vectors
**File**: `packages/contracts/crypto-test-vectors/golden-001.json`

**Requirements**:
1. **Deterministic Test**: Fixed server keypair + fixed ephemeral key + fixed nonce → identical ciphertext across TS/Kotlin/Swift
2. **Decrypt Compatibility**: Each language decrypts ciphertext produced by others
3. **Tamper Detection**: Flip 1 bit in tag → all languages reject

**CI Job**: `Cross-Language Contract Tests` verifies compatibility

### Nonce Uniqueness
- **Test**: 100,000 encryptions with 0 collisions
- **Source**: `crypto.getRandomValues()` (browser), `SecureRandom` (Android), `SecRandomCopyBytes` (iOS)
- **Collision Probability**: ~2^-48 for 100k samples from 96-bit space (negligible)

### Tamper Tests
All 3 languages must reject:
- Ciphertext modification (1 bit flip)
- Tag modification (1 bit flip)
- AAD modification (change envelope field)
- Nonce modification (change nonce)
- Key ID mismatch

---

## Consequences

### Positive
- ✅ Battle-tested algorithms (IETF standards)
- ✅ No custom crypto implementation
- ✅ Cross-platform compatibility verified
- ✅ Hardware acceleration on iOS (Secure Enclave)
- ✅ AAD binding prevents metadata tampering

### Negative
- ⚠️ X25519 not post-quantum (acceptable risk until 2030+)
- ⚠️ Android Keystore requires API 23+ (graceful degradation)
- ⚠️ Ephemeral key generation adds ~1ms latency per encryption

### Risks
- **Key Compromise**: Server private key leak decrypts all messages → **Mitigation**: HSM + quarterly rotation
- **Implementation Bug**: Subtle crypto errors hard to detect → **Mitigation**: Golden vectors + external audit
- **Nonce Reuse**: Breaks ChaCha20 security → **Mitigation**: 100k uniqueness test + entropy source validation

---

## References

- [RFC 7748: Elliptic Curves for Security (X25519)](https://tools.ietf.org/html/rfc7748)
- [RFC 5869: HKDF - HMAC-based Extract-and-Expand Key Derivation Function](https://tools.ietf.org/html/rfc5869)
- [RFC 8439: ChaCha20 and Poly1305 for IETF Protocols](https://tools.ietf.org/html/rfc8439)
- [Key Management Documentation](../security/key-management.md)
- [ADR-007: Contracts and Canonical JSON](ADR-007-contracts.md)

---

**Last Updated**: 2026-10-29  
**Version**: 1.0  
**Next Review**: 2027-01-29 (or upon key compromise incident)
