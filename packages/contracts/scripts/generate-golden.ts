#!/usr/bin/env tsx
/**
 * Generate golden-001.json test vector for cross-language crypto validation
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { encryptDeterministic } from '../src/crypto';
import * as testKeys from '../crypto-test-vectors/test-keys.json';

// Fixed deterministic inputs for golden vector
const FIXED_EPHEMERAL_PRIVATE = new Uint8Array([
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
  0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
  0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
]);

const FIXED_NONCE = new Uint8Array([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05,
  0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
]);

const FIXED_PAYLOAD = {
  sosText: 'Golden test vector',
  category: 'test',
  personsCount: 1,
  userLanguage: 'en',
};

const FIXED_ENVELOPE = {
  timestamp: '2026-10-29T21:00:00Z',
  location: {
    latitude: 39.9334,
    longitude: 32.8597,
    accuracy: 10,
  },
  priority: 1,
};

const config = {
  keyId: testKeys.keyId,
  serverPublicKey: testKeys.serverPublicKey,
  serverPrivateKey: testKeys.serverPrivateKey,
};

// Generate encrypted payload
const encrypted = encryptDeterministic(
  FIXED_PAYLOAD,
  FIXED_ENVELOPE,
  config,
  FIXED_EPHEMERAL_PRIVATE,
  FIXED_NONCE
);

// Extract ciphertext with tag as hex
const ciphertextWithTagBuffer = Buffer.from(encrypted.ciphertext, 'base64');
const ciphertextWithTagHex = ciphertextWithTagBuffer.toString('hex');

// Compute AAD (canonical JSON)
const sortKeys = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  
  const sorted: any = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortKeys(obj[key]);
  });
  return sorted;
};

const aadObject = sortKeys({
  envelope: FIXED_ENVELOPE,
  keyId: testKeys.keyId,
  protocol: 'v1',
});

const aadCanonical = JSON.stringify(aadObject);

// Create golden vector JSON
const golden = {
  WARNING: '⚠️  TEST ONLY - DO NOT USE IN PRODUCTION ⚠️',
  description: 'Deterministic golden test vector for cross-language crypto compatibility',
  algorithm: 'X25519+HKDF-SHA256+ChaCha20-Poly1305',
  protocol_version: 'v1',
  
  inputs: {
    keyId: testKeys.keyId,
    serverPublicKey: testKeys.serverPublicKey,
    serverPrivateKey: testKeys.serverPrivateKey,
    ephemeralPrivateKey: Buffer.from(FIXED_EPHEMERAL_PRIVATE).toString('base64'),
    nonce: Buffer.from(FIXED_NONCE).toString('base64'),
    plaintext: JSON.stringify(FIXED_PAYLOAD),
    envelope: FIXED_ENVELOPE,
  },
  
  expected: {
    ephemeralPublicKey: encrypted.ephemeralPublicKey,
    aadCanonical: aadCanonical,
    ciphertextWithTagHex: ciphertextWithTagHex,
    ciphertextWithTagBase64: encrypted.ciphertext,
  },
};

// Write to file
const outputPath = join(__dirname, '..', 'crypto-test-vectors', 'golden-001.json');
writeFileSync(outputPath, JSON.stringify(golden, null, 2) + '\n');

console.log('✓ Generated golden-001.json');
console.log('  Ephemeral Public:', encrypted.ephemeralPublicKey);
console.log('  Ciphertext+Tag (hex):', ciphertextWithTagHex);
console.log('  AAD:', aadCanonical);
