import { x25519 } from '@noble/curves/ed25519.js';
import { randomBytes } from '@noble/hashes/utils.js';
import * as fs from 'fs';
import * as path from 'path';

// Generate X25519 keypair for testing
const serverPrivateKey = randomBytes(32);
const serverPublicKey = x25519.getPublicKey(serverPrivateKey);

const testKeys = {
  "WARNING": "⚠️  TEST ONLY - DO NOT USE IN PRODUCTION ⚠️",
  "WARNING_2": "These keys are for cross-language test vector validation only",
  "WARNING_3": "Production keys must NEVER be committed to the repository",
  "keyId": "dev-test-001",
  "algorithm": "X25519+ChaCha20-Poly1305",
  "serverPublicKey": Buffer.from(serverPublicKey).toString('base64'),
  "serverPrivateKey": Buffer.from(serverPrivateKey).toString('base64'),
  "purpose": "Deterministic test vectors for TS/Kotlin/Swift crypto compatibility",
  "generated": new Date().toISOString()
};

const outputPath = path.join(__dirname, '../crypto-test-vectors/test-keys.json');
fs.writeFileSync(outputPath, JSON.stringify(testKeys, null, 2));

console.log('Generated new X25519 test keys:');
console.log('Server public:', testKeys.serverPublicKey);
console.log('Server private:', testKeys.serverPrivateKey);
console.log('Saved to:', outputPath);
