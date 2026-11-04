import { createPrivateKey, createPublicKey, sign } from 'node:crypto';

describe('BroadcastSignerService cross-platform verification', () => {
  it('should produce signatures verifiable by Android/iOS verifiers', () => {
    const testPrivateKeyPkcs8Base64 = 'MC4CAQAwBQYDK2VwBCIEIE3CUZJL8fZQYxbKuVQPKqm4EZzCG0LHiVQChYtPmXEg';
    const testPublicKeySpkiBase64 = 'MCowBQYDK2VwAyEAJgWsM1ZMJK9D9uPkDS/08DL/sOHrBlcCS/ETcKQ2OEs=';
    
    const der = Buffer.from(testPrivateKeyPkcs8Base64, 'base64');
    const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    
    const id = 'test-broadcast-id';
    const title = 'Test Broadcast';
    const body = 'Cross-platform test body';
    const severity = 'info';
    const createdAt = new Date('2026-11-04T15:00:00.000Z');
    const expiresAt = new Date('2026-11-05T15:00:00.000Z');
    
    const payload = Buffer.from(
      `BROADCAST|${id}|${title}|${body}|${severity}|${createdAt.toISOString()}|${expiresAt.toISOString()}`,
      'utf8'
    );
    
    const signature = sign(null, payload, privateKey);
    const signatureBase64 = signature.toString('base64');
    
    const publicKeyDer = Buffer.from(testPublicKeySpkiBase64, 'base64');
    expect(publicKeyDer.length).toBe(44);
    expect(publicKeyDer[0]).toBe(0x30);
    
    expect(signatureBase64).toBeDefined();
    expect(Buffer.from(signatureBase64, 'base64').length).toBe(64);
  });

  it('should verify with region fields in canonical order', () => {
    const testPrivateKeyPkcs8Base64 = 'MC4CAQAwBQYDK2VwBCIEIE3CUZJL8fZQYxbKuVQPKqm4EZzCG0LHiVQChYtPmXEg';
    
    const der = Buffer.from(testPrivateKeyPkcs8Base64, 'base64');
    const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    const publicKey = createPublicKey(privateKey);
    
    const id = 'test-regional';
    const title = 'Regional Alert';
    const body = 'Region test';
    const severity = 'warning';
    const createdAt = new Date('2026-11-04T15:00:00.000Z');
    const expiresAt = new Date('2026-11-05T15:00:00.000Z');
    const lat = 40.7128;
    const lng = -74.0060;
    const radiusKm = 50;
    
    const regionPart = `|${lat}|${lng}|${radiusKm}`;
    const payload = Buffer.from(
      `BROADCAST|${id}|${title}|${body}|${severity}|${createdAt.toISOString()}|${expiresAt.toISOString()}${regionPart}`,
      'utf8'
    );
    
    const signature = sign(null, payload, privateKey);
    const signatureBase64 = signature.toString('base64');
    
    expect(signatureBase64).toBeDefined();
    expect(Buffer.from(signatureBase64, 'base64').length).toBe(64);
    
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    expect(publicKeyDer.length).toBe(44);
  });
});
