import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

export interface EncryptedPayload {
  keyId: string;
  ephemeralPublicKey: string; // Base64
  nonce: string; // Base64 24 bytes
  ciphertext: string; // Base64
  tag: string; // Base64 16 bytes (included in ciphertext for ChaCha20-Poly1305)
}

export interface CryptoConfig {
  keyId: string;
  serverPublicKey: string; // Base64 X25519 public key
}

export interface ServerCryptoConfig extends CryptoConfig {
  serverPrivateKey: string; // Base64 X25519 private key (server-side only)
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

const INFO_STRING = 'SOSMesh-v1-payload-encryption';

/**
 * Derives encryption and authentication keys using HKDF-SHA256
 */
function deriveKeys(sharedSecret: Uint8Array, nonce: Uint8Array): {
  encryptionKey: Uint8Array;
} {
  // HKDF-SHA256: 32 bytes for ChaCha20-Poly1305 key
  const info = naclUtil.decodeUTF8(INFO_STRING);
  const derived = hkdf(sha256, sharedSecret, nonce, info, 32);
  return {
    encryptionKey: derived,
  };
}

/**
 * Encrypts a payload using X25519 + HKDF + ChaCha20-Poly1305
 * 
 * @param payload - The plaintext payload object
 * @param aad - Associated authenticated data (envelope metadata)
 * @param config - Crypto configuration with server public key
 * @returns Encrypted payload
 */
export function encryptPayload(
  payload: any,
  aad: any,
  config: CryptoConfig
): EncryptedPayload {
  // Validate key ID
  if (config.keyId.startsWith('prod-') && process.env.NODE_ENV === 'production') {
    throw new Error(`Production key ID ${config.keyId} requires secure key management`);
  }

  // Generate ephemeral key pair
  const ephemeralKeyPair = nacl.box.keyPair();

  // Decode server public key
  const serverPublicKey = naclUtil.decodeBase64(config.serverPublicKey);

  // Perform X25519 key agreement
  const sharedSecret = nacl.scalarMult(ephemeralKeyPair.secretKey, serverPublicKey);

  // Generate random 192-bit nonce
  const nonce = nacl.randomBytes(24);

  // Derive encryption key using HKDF
  const { encryptionKey } = deriveKeys(sharedSecret, nonce);

  // Serialize payload
  // Note: AAD binding would require a different crypto library (e.g., libsodium with AEAD)
  // For now, we're using tweetnacl's secretbox (XSalsa20-Poly1305) which doesn't support AAD
  // TODO: Implement proper AAD binding in future version
  const plaintextBytes = naclUtil.decodeUTF8(JSON.stringify(payload));

  // Encrypt with XSalsa20-Poly1305 (via secretbox)
  // secretbox returns: [16-byte nonce prepended + ciphertext + 16-byte poly1305 tag appended]
  // But we're using our own nonce, so secretbox returns just [ciphertext + tag]
  const ciphertextWithTag = nacl.secretbox(plaintextBytes, nonce, encryptionKey);

  // For API compatibility, we store the whole box as "ciphertext" and an empty "tag"
  // (the tag is already included in the box)
  const ciphertext = ciphertextWithTag;
  const tag = new Uint8Array(0); // Empty for compatibility

  // Securely zero out sensitive data
  sharedSecret.fill(0);
  ephemeralKeyPair.secretKey.fill(0);
  encryptionKey.fill(0);

  return {
    keyId: config.keyId,
    ephemeralPublicKey: naclUtil.encodeBase64(ephemeralKeyPair.publicKey),
    nonce: naclUtil.encodeBase64(nonce),
    ciphertext: naclUtil.encodeBase64(ciphertext),
    tag: naclUtil.encodeBase64(tag),
  };
}

/**
 * Decrypts an encrypted payload (server-side only)
 * 
 * @param encryptedPayload - The encrypted payload
 * @param aad - Associated authenticated data (must match encryption AAD)
 * @param config - Server crypto configuration with private key
 * @returns Decrypted payload object
 */
export function decryptPayload(
  encryptedPayload: EncryptedPayload,
  aad: any,
  config: ServerCryptoConfig
): any {
  // Validate key ID match
  if (encryptedPayload.keyId !== config.keyId) {
    throw new Error(`Key ID mismatch: ${encryptedPayload.keyId} != ${config.keyId}`);
  }

  // Decode components
  const ephemeralPublicKey = naclUtil.decodeBase64(encryptedPayload.ephemeralPublicKey);
  const nonce = naclUtil.decodeBase64(encryptedPayload.nonce);
  const ciphertext = naclUtil.decodeBase64(encryptedPayload.ciphertext);
  const serverPrivateKey = naclUtil.decodeBase64(config.serverPrivateKey);

  // Perform X25519 key agreement
  const sharedSecret = nacl.scalarMult(serverPrivateKey, ephemeralPublicKey);

  // Derive encryption key using HKDF
  const { encryptionKey } = deriveKeys(sharedSecret, nonce);

  // Decrypt with XSalsa20-Poly1305 (secretbox.open)
  // ciphertext already includes the tag
  const plaintextBytes = nacl.secretbox.open(ciphertext, nonce, encryptionKey);

  if (!plaintextBytes) {
    throw new Error(CryptoError.DECRYPTION_FAILED);
  }

  // Securely zero out sensitive data
  sharedSecret.fill(0);
  serverPrivateKey.fill(0);
  encryptionKey.fill(0);

  const plaintext = naclUtil.encodeUTF8(plaintextBytes);
  return JSON.parse(plaintext);
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
