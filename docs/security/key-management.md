# SOSMesh Key Management

## ADIM 09: Cryptography & Local Privacy - Key Management Strategy

### Overview

SOSMesh implements **ephemeral-static ECDH** with **server-pinned public keys** for end-to-end encryption of SOS payloads. This document describes key generation, storage, rotation, and compromise procedures.

---

## Encryption Algorithm

- **Key Agreement**: X25519 (Curve25519 ECDH)
- **Key Derivation**: HKDF-SHA256 (RFC 5869)
- **AEAD Cipher**: IETF ChaCha20-Poly1305 (RFC 8439)
- **AAD Binding**: Canonical JSON of envelope metadata + keyId + protocol version
- **Nonce**: 96-bit (12-byte) random, unique per encryption

---

## Key Types

### 1. Server Key Pair (Long-Lived)
- **Purpose**: Decrypt SOS payloads at relay/server
- **Algorithm**: X25519 (32-byte private key, 32-byte public key)
- **Lifetime**: 90 days (rotated quarterly)
- **Storage**:
  - **Development**: In-memory or file-based (JVM `InMemoryKeyStorage`, Swift `InMemoryKeyStorage`)
  - **Production**: Hardware Security Module (HSM) or KMS (AWS KMS, Google Cloud KMS, Azure Key Vault)
- **Distribution**: Public key pinned in client apps (via secure channel during app build/update)

### 2. Client Ephemeral Key Pair (Single-Use)
- **Purpose**: Per-message encryption; never reused
- **Algorithm**: X25519 (32-byte private key, 32-byte public key)
- **Lifetime**: Single encryption operation
- **Storage**: Generated in-memory, discarded after use
- **Distribution**: Public key sent with encrypted payload

### 3. Derived Encryption Key (Transient)
- **Purpose**: ChaCha20-Poly1305 symmetric key
- **Derivation**: `HKDF-SHA256(sharedSecret, salt=nonce, info="SOSMesh-v1-{keyId}-encryption")`
- **Lifetime**: Single encryption/decryption operation
- **Storage**: Memory-only, never persisted

---

## Development vs Production

### Development Environment
- **Key Storage**: `dev-test-001` keys in `packages/contracts/crypto-test-vectors/test-keys.json`
- **Warnings**: Files labeled `⚠️ TEST ONLY - DO NOT USE IN PRODUCTION ⚠️`
- **Secret Scanner**: Test keys allowlisted with explicit justification
- **Validation**: Production config rejects `dev-test-*` keyIds

### Production Environment
- **Key Generation**: Performed by authorized operator with MFA/audit trail
- **Key Storage**: HSM or KMS with access control policies
- **Key Distribution**: Public key embedded in signed app bundle (iOS/Android code signing)
- **Key Rotation**: Quarterly (90 days); overlapping grace period for smooth transition

---

## Key Rotation

### Rotation Schedule
- **Frequency**: Every 90 days
- **Grace Period**: 30 days (old key remains valid for decryption)
- **Active Keys**: Multiple public keys supported simultaneously (identified by `keyId`)

### Rotation Process
1. **Generate New Key Pair**: Operator generates new X25519 keypair with `keyId = "prod-2026-Q4-001"`
2. **Deploy Public Key**: Push app update with new public key pinned
3. **Update Server Config**: Add new private key to HSM/KMS (old key remains for grace period)
4. **Monitor Transition**: Track usage of old vs new `keyId` in encrypted payloads
5. **Retire Old Key**: After grace period, remove old private key from HSM/KMS

### Rotation Triggers
- **Scheduled**: Every 90 days (planned)
- **Compromise**: Immediately (unplanned)
- **Algorithm Upgrade**: Upon cryptographic algorithm migration (e.g., post-quantum)

---

## Compromise Response

### Detection
- **Indicators**:
  - Unauthorized access to HSM/KMS logs
  - Suspicious decryption activity (volume, geographic pattern)
  - Third-party security advisory (e.g., X25519 vulnerability)

### Response Procedure
1. **Incident Declared**: Security team activated (within 1 hour)
2. **Immediate Key Rotation**: Generate and deploy new keypair (emergency process, <4 hours)
3. **Revoke Compromised Key**: Remove from HSM/KMS immediately
4. **User Notification**: Push notification to all users to update app (if old key version)
5. **Forensic Analysis**: Investigate breach vector and mitigate
6. **Post-Incident Review**: Update key management procedures

### Fallback Mechanism
- **Degraded Mode**: If key compromise affects all active keys, SOSMesh continues to operate **without encryption** with clear user warning
- **112 Emergency Calls**: Always prioritized; encrypted channel failure does not block emergency services

---

## Platform-Specific Storage

### Android (Kotlin)
- **Interface**: `KeyStorage` in `packages/contracts-kotlin/src/main/kotlin/Crypto.kt`
- **Production**: `AndroidKeystoreAdapter` using Android Keystore System
  - Keys stored in hardware-backed Keystore (TEE/StrongBox when available)
  - Access control: Biometric authentication required for key use
  - **Status**: `NOT_TESTED` (requires real Android device; CI uses `InMemoryKeyStorage`)
- **Development**: `InMemoryKeyStorage` (JVM testing only)

### iOS (Swift)
- **Interface**: `KeyStorage` in `packages/contracts-swift/Sources/SOSMeshContracts/Crypto.swift`
- **Production**: `KeychainAdapter` using iOS Keychain Services
  - Keys stored in Secure Enclave (when available)
  - Access control: Face ID / Touch ID authentication
  - **Status**: `NOT_TESTED` (requires real iOS device; CI uses `InMemoryKeyStorage`)
- **Development**: `InMemoryKeyStorage` (testing only)

### TypeScript (Node.js / Browser)
- **Interface**: N/A (ephemeral keys only; no long-lived storage)
- **Production**: Ephemeral keypairs generated per encryption (no persistence)
- **Development**: Same as production (stateless)

---

## Security Considerations

### Threat Model
- **Adversary Goals**:
  - Decrypt SOS message content (location, personal info)
  - Impersonate user or relay
  - Denial of service
- **Assumptions**:
  - Relays are **untrusted** (honest-but-curious)
  - Server infrastructure is **semi-trusted** (secure but monitored)
  - Client devices may be **compromised** (malware, physical access)

### Mitigations
- **Ephemeral Keys**: No long-term key reuse on client → forward secrecy per message
- **Server-Pinned Public Key**: Prevents MITM attacks during key exchange
- **AAD Binding**: Envelope metadata authenticated → prevents tampering/replay
- **Nonce Uniqueness**: Random 96-bit nonce per encryption → no IV reuse
- **Tag Verification**: Poly1305 MAC → integrity + authenticity

### Out of Scope
- **Post-Quantum Cryptography**: Current X25519 is vulnerable to quantum computers; migration planned for 2030+ (monitor NIST PQC standards)
- **Multi-Party Encryption**: SOSMesh encrypts to single server public key; group encryption not supported
- **Key Escrow**: No key escrow or backdoor mechanism (policy decision)

---

## Compliance & Audit

### Logging
- **Key Generation**: Logged with timestamp, operator ID, keyId
- **Key Access**: HSM/KMS access logs monitored (AWS CloudTrail, GCP Audit Logs)
- **Decryption Operations**: Rate-limited and anomaly-detected

### Auditing
- **Frequency**: Quarterly review of key rotation logs
- **Scope**: Key lifecycle (generation, storage, rotation, deletion)
- **Responsible**: Security team + external auditor (annual)

---

## Testing & Validation

### Cross-Language Compatibility
- **Golden Test Vectors**: Deterministic test cases in `packages/contracts/crypto-test-vectors/`
- **Languages**: TypeScript, Kotlin, Swift
- **Verification**: Each implementation encrypts and decrypts identical payloads
- **CI Job**: `Cross-Language Contract Tests` ensures compatibility

### Tamper Detection
- **Test Coverage**: Ciphertext, tag, AAD, nonce, keyId modification → all rejected
- **Mutation Testing**: Disable tag/AAD verification → tamper tests fail (proves tests are valid)

### Nonce Uniqueness
- **Test**: 10k encryptions with 0 collisions (representative sample)
- **Full Test**: 100k+ with `NONCE_FULL_TEST=1` (local validation)

---

## References

- [RFC 7748: Elliptic Curves for Security (X25519)](https://tools.ietf.org/html/rfc7748)
- [RFC 5869: HKDF - HMAC-based Extract-and-Expand Key Derivation Function](https://tools.ietf.org/html/rfc5869)
- [RFC 8439: ChaCha20 and Poly1305 for IETF Protocols](https://tools.ietf.org/html/rfc8439)
- [ADR-009: Cryptography and Local Privacy](../adr/ADR-009-crypto-and-privacy.md)

---

**Last Updated**: 2026-10-29  
**Version**: 1.0  
**Owner**: Security Team
