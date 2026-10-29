import { describe, it, expect } from 'vitest';
import { encryptDeterministic, decryptPayload } from './crypto';
import * as goldenVector from '../crypto-test-vectors/golden-001.json';

describe('Golden Test Vectors - Cross-Language Compatibility', () => {
  const config = {
    keyId: goldenVector.inputs.keyId,
    serverPublicKey: goldenVector.inputs.serverPublicKey,
    serverPrivateKey: goldenVector.inputs.serverPrivateKey,
  };

  const ephemeralPrivateKey = Buffer.from(goldenVector.inputs.ephemeralPrivateKey, 'base64');
  const nonce = Buffer.from(goldenVector.inputs.nonce, 'base64');
  const payload = JSON.parse(goldenVector.inputs.plaintext);
  const envelope = goldenVector.inputs.envelope;

  it('testGoldenEncryptMatches - should produce identical ciphertext with fixed inputs', () => {
    // Encrypt with deterministic inputs
    const encrypted = encryptDeterministic(
      payload,
      envelope,
      config,
      ephemeralPrivateKey,
      nonce
    );

    // Extract ciphertext+tag as hex
    const ciphertextWithTagHex = Buffer.from(encrypted.ciphertext, 'base64').toString('hex');
    
    // Should match golden vector exactly
    expect(ciphertextWithTagHex).toBe(goldenVector.expected.ciphertextWithTagHex);
    expect(encrypted.ephemeralPublicKey).toBe(goldenVector.expected.ephemeralPublicKey);
    expect(encrypted.nonce).toBe(Buffer.from(nonce).toString('base64'));
    
    console.log('✓ TypeScript: Golden encrypt matches (byte-for-byte)');
  });

  it('testGoldenDecrypt - should decrypt golden vector ciphertext', () => {
    // Use golden vector ciphertext
    const encryptedPayload = {
      keyId: goldenVector.inputs.keyId,
      ephemeralPublicKey: goldenVector.expected.ephemeralPublicKey,
      nonce: goldenVector.inputs.nonce,
      ciphertext: goldenVector.expected.ciphertextWithTagBase64,
    };

    // Decrypt
    const decrypted = decryptPayload(encryptedPayload, envelope, config);
    
    // Should match original payload
    expect(decrypted).toEqual(payload);
    
    console.log('✓ TypeScript: Golden decrypt successful');
  });

  it('testGoldenTamperedRejected - should reject tampered golden vector', () => {
    // First verify unmodified golden decrypts successfully
    const validEncrypted = {
      keyId: goldenVector.inputs.keyId,
      ephemeralPublicKey: goldenVector.expected.ephemeralPublicKey,
      nonce: goldenVector.inputs.nonce,
      ciphertext: goldenVector.expected.ciphertextWithTagBase64,
    };
    
    const validDecrypted = decryptPayload(validEncrypted, envelope, config);
    expect(validDecrypted).toEqual(payload);

    // Now tamper: flip last byte of tag (last byte of ciphertext+tag)
    const ciphertextBuffer = Buffer.from(goldenVector.expected.ciphertextWithTagBase64, 'base64');
    ciphertextBuffer[ciphertextBuffer.length - 1] ^= 0x01; // Flip 1 bit in tag
    
    const tamperedEncrypted = {
      ...validEncrypted,
      ciphertext: ciphertextBuffer.toString('base64'),
    };

    // Should throw
    expect(() => decryptPayload(tamperedEncrypted, envelope, config)).toThrow();
    
    console.log('✓ TypeScript: Tampered golden rejected');
  });
});
