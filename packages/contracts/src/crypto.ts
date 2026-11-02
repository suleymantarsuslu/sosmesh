import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { sortKeys } from './canonical-json.js';

export interface EncryptedPayload {
  keyId: string;
  ephemeralPublicKey: string; // Base64
  nonce: string; // Base64 12 bytes (IETF ChaCha20-Poly1305)
  ciphertext: string; // Base64 (includes 16-byte Poly1305 tag)
}

export interface CryptoConfig {
  keyId: string;
  serverPublicKey: string; // Base64 X25519 public key (32 bytes)
}

export interface ServerCryptoConfig extends CryptoConfig {
  serverPrivateKey: string; // Base64 X25519 private key (32 bytes)
}

export enum CryptoError {
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  KEY_EXPIRED = 'KEY_EXPIRED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_TAG = 'INVALID_TAG',
  NONCE_COLLISION = 'NONCE_COLLISION',
  KEYSTORE_UNAVAILABLE = 'KEYSTORE_UNAVAILABLE',
  INVALID_KEY_ID = 'INVALID_KEY_ID',
}

export const CRYPTO_ERROR_MESSAGES = {
  [CryptoError.KEY_NOT_FOUND]: {
    tr: 'Güvenlik anahtarı bulunamadı. SOS mesajınız şifrelenmeden gönderilecek. Acil durumlar için 112\'yi arayın.',
    en: 'Security key not found. Your SOS will be sent unencrypted. For emergencies, call 112.',
  },
  [CryptoError.KEYSTORE_UNAVAILABLE]: {
    tr: 'Cihaz güvenliği kullanılamıyor. Mesajınız geçici anahtarla korunacak.',
    en: 'Device security unavailable. Your message will use temporary protection.',
  },
  [CryptoError.DECRYPTION_FAILED]: {
    tr: 'Mesaj şifresi çözülemedi.',
    en: 'Message decryption failed.',
  },
  [CryptoError.INVALID_TAG]: {
    tr: 'Mesaj bütünlüğü doğrulanamadı.',
    en: 'Message integrity verification failed.',
  },
};

const PROTOCOL_VERSION = 'v1';

/**
 * Derives encryption key using HKDF-SHA256
 * Info string includes protocol version and key ID for domain separation
 */
function deriveEncryptionKey(
  sharedSecret: Uint8Array,
  salt: Uint8Array,
  keyId: string
): Uint8Array {
  const info = new TextEncoder().encode(`SOSMesh-${PROTOCOL_VERSION}-${keyId}-encryption`);
  // HKDF-SHA256: 32 bytes for ChaCha20-Poly1305 key
  return hkdf(sha256, sharedSecret, salt, info, 32);
}

/**
 * Creates canonical JSON string for AAD
 * Ensures consistent serialization across platforms
 */
function createAAD(envelope: any, keyId: string, protocolVersion: string): Uint8Array {
  const aadObject = sortKeys({
    envelope: envelope,
    keyId: keyId,
    protocol: protocolVersion,
  });
  const canonical = JSON.stringify(aadObject);
  return new TextEncoder().encode(canonical);
}

/**
 * Base64 encode
 */
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Base64 decode
 */
function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64'));
}

/**
 * @internal
 * Test-only deterministic encryption with fixed ephemeral key and nonce.
 * DO NOT USE IN PRODUCTION - for golden test vectors only.
 */
export function encryptDeterministic(
  payload: any,
  envelope: any,
  config: CryptoConfig,
  ephemeralPrivateKey: Uint8Array,
  nonce: Uint8Array
): EncryptedPayload {
  if (ephemeralPrivateKey.length !== 32) {
    throw new Error('ephemeralPrivateKey must be 32 bytes');
  }
  if (nonce.length !== 12) {
    throw new Error('nonce must be 12 bytes');
  }

  // Generate ephemeral public key
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

  // Decode server public key
  const serverPublicKey = fromBase64(config.serverPublicKey);

  // Perform X25519 key agreement (ECDH)
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, serverPublicKey);

  // Derive encryption key using HKDF (salt = nonce, info = versioned + key id)
  const encryptionKey = deriveEncryptionKey(sharedSecret, nonce, config.keyId);

  // Create AAD from envelope metadata
  const aad = createAAD(envelope, config.keyId, PROTOCOL_VERSION);

  // Serialize payload
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(payload));

  // Encrypt with IETF ChaCha20-Poly1305 (AAD authenticated)
  const cipher = chacha20poly1305(encryptionKey, nonce, aad);
  const ciphertextWithTag = cipher.encrypt(plaintextBytes);

  // Securely zero out sensitive data
  sharedSecret.fill(0);
  encryptionKey.fill(0);

  return {
    keyId: config.keyId,
    ephemeralPublicKey: toBase64(ephemeralPublicKey),
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertextWithTag), // Includes 16-byte Poly1305 tag
  };
}

/**
 * Encrypts a payload using X25519 + HKDF + IETF ChaCha20-Poly1305
 * 
 * @param payload - The plaintext payload object
 * @param envelope - Envelope metadata (used as AAD)
 * @param config - Crypto configuration with server public key
 * @returns Encrypted payload
 */
export function encryptPayload(
  payload: any,
  envelope: any,
  config: CryptoConfig
): EncryptedPayload {
  // Validate key ID
  if (config.keyId.startsWith('prod-') && process.env.NODE_ENV === 'production') {
    throw new Error(`Production key ID ${config.keyId} requires secure key management`);
  }

  // Generate ephemeral X25519 key pair (32 bytes private key)
  const ephemeralPrivateKey = randomBytes(32);
  
  // Generate random 96-bit nonce for IETF ChaCha20-Poly1305
  const nonce = randomBytes(12);

  return encryptDeterministic(payload, envelope, config, ephemeralPrivateKey, nonce);
}

/**
 * Decrypts an encrypted payload (server-side only)
 * 
 * @param encryptedPayload - The encrypted payload
 * @param envelope - Envelope metadata (must match encryption AAD)
 * @param config - Server crypto configuration with private key
 * @returns Decrypted payload object
 */
export function decryptPayload(
  encryptedPayload: EncryptedPayload,
  envelope: any,
  config: ServerCryptoConfig
): any {
  // Validate key ID match
  if (encryptedPayload.keyId !== config.keyId) {
    throw new Error(`Key ID mismatch: ${encryptedPayload.keyId} != ${config.keyId}`);
  }

  // Decode components
  const ephemeralPublicKey = fromBase64(encryptedPayload.ephemeralPublicKey);
  const nonce = fromBase64(encryptedPayload.nonce);
  const ciphertextWithTag = fromBase64(encryptedPayload.ciphertext);
  const serverPrivateKey = fromBase64(config.serverPrivateKey);

  // Perform X25519 key agreement
  const sharedSecret = x25519.getSharedSecret(serverPrivateKey, ephemeralPublicKey);

  // Derive encryption key using HKDF
  const encryptionKey = deriveEncryptionKey(sharedSecret, nonce, config.keyId);

  // Create AAD from envelope metadata (must match encryption AAD)
  const aad = createAAD(envelope, config.keyId, PROTOCOL_VERSION);

  try {
    // Decrypt with IETF ChaCha20-Poly1305
    const decipher = chacha20poly1305(encryptionKey, nonce, aad);
    const plaintextBytes = decipher.decrypt(ciphertextWithTag);

    // Securely zero out sensitive data
    sharedSecret.fill(0);
    serverPrivateKey.fill(0);
    encryptionKey.fill(0);

    const plaintext = new TextDecoder().decode(plaintextBytes);
    return JSON.parse(plaintext);
  } catch (error) {
    // Securely zero out sensitive data even on error
    sharedSecret.fill(0);
    serverPrivateKey.fill(0);
    encryptionKey.fill(0);
    throw new Error(CryptoError.DECRYPTION_FAILED);
  }
}

/**
 * Validates crypto config for production environment
 */
export function validateCryptoConfig(config: CryptoConfig, env: string): void {
  if (env === 'production' && config.keyId.startsWith('dev-')) {
    throw new Error(`Dev key ${config.keyId} not allowed in production`);
  }
}

/**
 * Sanitizes object for logging (removes sensitive fields)
 */
export function sanitizeForLog(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const redacted: any = Array.isArray(obj) ? [] : {};

  for (const key of Object.keys(obj)) {
    // Redact sensitive fields
    if (
      key === 'sosText' ||
      key === 'plaintext' ||
      key === 'serverPrivateKey' ||
      key === 'ephemeralPrivateKey' ||
      key === 'sharedSecret' ||
      key === 'encryptionKey' ||
      key === 'decryptionKey'
    ) {
      redacted[key] = '[REDACTED]';
    } else if (key === 'location' && obj[key]) {
      // Redact GPS coordinates but keep accuracy
      redacted[key] = { accuracy: obj[key].accuracy };
    } else if (key === 'nonce' && obj.encryptionKey) {
      // nonce+key pair is sensitive
      continue;
    } else if (typeof obj[key] === 'object') {
      redacted[key] = sanitizeForLog(obj[key]);
    } else {
      redacted[key] = obj[key];
    }
  }

  return redacted;
}
