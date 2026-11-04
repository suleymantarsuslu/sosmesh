import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { BroadcastSignerService } from './broadcast-signer.service';

describe('BroadcastSignerService cross-platform verification', () => {
  it('should produce Ed25519 signatures verifiable with derived public key', () => {
    const testPrivateKeyPkcs8Base64 = 'MC4CAQAwBQYDK2VwBCIEIE3CUZJL8fZQYxbKuVQPKqm4EZzCG0LHiVQChYtPmXEg';
    
    const der = Buffer.from(testPrivateKeyPkcs8Base64, 'base64');
    const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    const publicKey = createPublicKey(privateKey);
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    const testPublicKeySpkiBase64 = publicKeyDer.toString('base64');
    
    const id = 'test-broadcast-id';
    const title = 'Test Broadcast';
    const body = 'Cross-platform test body';
    const severity = 'info';
    const createdAt = new Date('2026-11-04T15:00:00.000Z');
    const expiresAt = new Date('2026-11-05T15:00:00.000Z');
    
    const canonicalPayload = BroadcastSignerService.canonicalize({
      id,
      title,
      body,
      severity,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      regionLatitude: null,
      regionLongitude: null,
      regionRadiusKm: null,
    });
    
    const signature = sign(null, Buffer.from(canonicalPayload, 'utf8'), privateKey);
    const signatureBase64 = signature.toString('base64');
    
    expect(publicKeyDer.length).toBe(44);
    expect(publicKeyDer[0]).toBe(0x30);
    expect(Buffer.from(signatureBase64, 'base64').length).toBe(64);
    
    const isValid = verify(null, Buffer.from(canonicalPayload, 'utf8'), publicKey, signature);
    expect(isValid).toBe(true);
  });

  it('should verify region fields using canonical order', () => {
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
    
    const canonicalPayload = BroadcastSignerService.canonicalize({
      id,
      title,
      body,
      severity,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      regionLatitude: lat,
      regionLongitude: lng,
      regionRadiusKm: radiusKm,
    });
    
    const signature = sign(null, Buffer.from(canonicalPayload, 'utf8'), privateKey);
    const signatureBase64 = signature.toString('base64');
    
    expect(Buffer.from(signatureBase64, 'base64').length).toBe(64);
    
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    expect(publicKeyDer.length).toBe(44);
    
    const isValid = verify(null, Buffer.from(canonicalPayload, 'utf8'), publicKey, signature);
    expect(isValid).toBe(true);
  });
});
