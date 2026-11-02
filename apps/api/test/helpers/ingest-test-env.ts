import { generateKeyPairSync } from 'node:crypto';

let cachedPrivateKeyBase64: string | undefined;

export function testIngestSigningPrivateKeyBase64(): string {
  if (!cachedPrivateKeyBase64) {
    const { privateKey } = generateKeyPairSync('ed25519');
    cachedPrivateKeyBase64 = privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .toString('base64');
  }
  return cachedPrivateKeyBase64;
}

export function applyTestIngestEnv(): void {
  if (!process.env.INGEST_RECEIPT_SIGNING_PRIVATE_KEY) {
    process.env.INGEST_RECEIPT_SIGNING_PRIVATE_KEY = testIngestSigningPrivateKeyBase64();
  }
  if (!process.env.INGEST_RATE_LIMIT_MAX) {
    process.env.INGEST_RATE_LIMIT_MAX = '500';
  }
}

export function testIngestPublicKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const encoded = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  process.env.INGEST_RECEIPT_SIGNING_PRIVATE_KEY = encoded;
  return publicKey;
}
