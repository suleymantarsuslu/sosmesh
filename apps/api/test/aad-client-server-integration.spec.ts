/**
 * Client-Server AAD Integration Tests
 * 
 * Verifies that the server's AAD extraction matches exactly what iOS and Android clients send.
 * Tests the full flow: client encrypts → server stores AAD → server decrypts.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { encryptPayload, decryptPayload, canonicalJSON } from '@sosmesh/contracts';
import { extractClientAad } from '../src/ingest/envelope-aad-builder';

describe('Client-Server AAD Integration', () => {
  const testConfig = {
    keyId: 'test-key-001',
    serverPublicKey: 'M8tCMh3Xzp8jG6F2K7JvnX1A9cD3LqZwE5Y4bT8mN0Q=',
    serverPrivateKey: 'OHV0FGQrp8sJ9x5Ew2Z3T6K7bN1A8cD4G5mF9qY0Lz8=',
  };

  describe('iOS client AAD format (IosSosMessageComposer.swift)', () => {
    it('should decrypt iOS message with no location (location = NSNull)', () => {
      const iOSEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
      };

      const payload = {
        sos_type: 'GENERAL',
        note: 'iOS message without location',
        language: 'en',
      };

      const encrypted = encryptPayload(payload, iOSEnvelope, testConfig);

      const wireEnvelope = {
        ...iOSEnvelope,
        ackLevel: 'DEVICE_STORED',
        relayCount: 0,
      };

      const serverExtractedAad = extractClientAad(wireEnvelope);
      const serverAadJson = canonicalJSON(serverExtractedAad);
      const clientAadJson = canonicalJSON(iOSEnvelope);

      expect(serverAadJson).toBe(clientAadJson);

      const decrypted = decryptPayload(encrypted, serverExtractedAad, testConfig);
      expect(decrypted.note).toBe('iOS message without location');
    });

    it('should decrypt iOS message with coarse GPS location (rounded to 2 decimals)', () => {
      const iOSEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'GPS',
        location: {
          latitude: 41.01,
          longitude: 28.98,
          accuracy: 1000,
        },
        priority: 1,
      };

      const payload = {
        sos_type: 'GENERAL',
        note: 'iOS message with GPS',
        location: {
          latitude: 41.008234,
          longitude: 28.978456,
          accuracy_meters: 15.5,
          timestamp: '2026-11-03T21:42:00.123Z',
        },
        language: 'en',
      };

      const encrypted = encryptPayload(payload, iOSEnvelope, testConfig);

      const wireEnvelope = {
        ...iOSEnvelope,
        ackLevel: 'PEER_RECEIVED',
        relayCount: 1,
      };

      const serverExtractedAad = extractClientAad(wireEnvelope);
      const serverAadJson = canonicalJSON(serverExtractedAad);
      const clientAadJson = canonicalJSON(iOSEnvelope);

      expect(serverAadJson).toBe(clientAadJson);

      const decrypted = decryptPayload(encrypted, serverExtractedAad, testConfig);
      expect(decrypted.note).toBe('iOS message with GPS');
      expect(decrypted.location.latitude).toBe(41.008234);
    });

    it('should decrypt iOS message with manual location (no accuracy)', () => {
      const iOSEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'MANUAL',
        location: {
          latitude: 41.01,
          longitude: 28.98,
        },
        priority: 1,
      };

      const payload = {
        sos_type: 'GENERAL',
        note: 'iOS message with manual location',
        location: {
          latitude: 41.008234,
          longitude: 28.978456,
          timestamp: '2026-11-03T21:42:00.123Z',
        },
        language: 'en',
      };

      const encrypted = encryptPayload(payload, iOSEnvelope, testConfig);

      const wireEnvelope = {
        ...iOSEnvelope,
        ackLevel: 'SERVER_ACCEPTED',
        relayCount: 2,
      };

      const serverExtractedAad = extractClientAad(wireEnvelope);
      const decrypted = decryptPayload(encrypted, serverExtractedAad, testConfig);
      expect(decrypted.note).toBe('iOS message with manual location');
    });
  });

  describe('Android client AAD format (SosMessageComposer.kt)', () => {
    it('should decrypt Android message with no location (location = null)', () => {
      const androidEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
      };

      const payload = {
        sos_type: 'GENERAL',
        person_count: null,
        note: 'Android message without location',
        location: null,
        language: 'en',
      };

      const encrypted = encryptPayload(payload, androidEnvelope, testConfig);

      const wireEnvelope = {
        ...androidEnvelope,
        ackLevel: 'DEVICE_STORED',
        relayCount: 0,
      };

      const serverExtractedAad = extractClientAad(wireEnvelope);
      const serverAadJson = canonicalJSON(serverExtractedAad);
      const clientAadJson = canonicalJSON(androidEnvelope);

      expect(serverAadJson).toBe(clientAadJson);

      const decrypted = decryptPayload(encrypted, serverExtractedAad, testConfig);
      expect(decrypted.note).toBe('Android message without location');
    });

    it('should decrypt Android message with GPS location', () => {
      const androidEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'GPS',
        location: {
          latitude: 41.01,
          longitude: 28.98,
          accuracy: 1000,
        },
        priority: 1,
      };

      const payload = {
        sos_type: 'MEDICAL',
        person_count: 2,
        note: 'Android message with GPS',
        location: {
          latitude: 41.008234,
          longitude: 28.978456,
          accuracy_meters: 15.5,
          timestamp: '2026-11-03T21:42:00.123Z',
        },
        language: 'tr',
      };

      const encrypted = encryptPayload(payload, androidEnvelope, testConfig);

      const wireEnvelope = {
        ...androidEnvelope,
        ackLevel: 'SERVER_ACCEPTED',
        relayCount: 3,
      };

      const serverExtractedAad = extractClientAad(wireEnvelope);
      const decrypted = decryptPayload(encrypted, serverExtractedAad, testConfig);
      expect(decrypted.note).toBe('Android message with GPS');
    });
  });

  describe('Real production failure scenario', () => {
    it('should reproduce the DECRYPTION_FAILED error with wrong AAD', () => {
      const correctClientAad = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
      };

      const payload = {
        sos_type: 'GENERAL',
        note: 'Real iPhone SOS message',
        language: 'en',
      };

      const encrypted = encryptPayload(payload, correctClientAad, testConfig);

      const wrongServerStoredAad = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        priority: 1,
        ackLevel: 'DEVICE_STORED',
        relayCount: 0,
      };

      expect(() => {
        decryptPayload(encrypted, wrongServerStoredAad, testConfig);
      }).toThrow('DECRYPTION_FAILED');
    });

    it('should succeed with extracted AAD from legacy stored format', () => {
      const correctClientAad = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
      };

      const payload = {
        sos_type: 'GENERAL',
        note: 'Fixed after deploy',
        language: 'en',
      };

      const encrypted = encryptPayload(payload, correctClientAad, testConfig);

      const legacyWireEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        priority: 1,
        ackLevel: 'DEVICE_STORED',
        relayCount: 0,
      };

      const extractedAad = extractClientAad(legacyWireEnvelope);
      const decrypted = decryptPayload(encrypted, extractedAad, testConfig);
      expect(decrypted.note).toBe('Fixed after deploy');
    });
  });

  describe('Canonical JSON key ordering', () => {
    it('should match client canonical JSON format', () => {
      const aad = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'GPS',
        location: {
          latitude: 41.01,
          longitude: 28.98,
          accuracy: 1000,
        },
        priority: 1,
      };

      const canonical = canonicalJSON(aad);

      expect(canonical).toBe(
        '{"location":{"accuracy":1000,"latitude":41.01,"longitude":28.98},"locationStatus":"GPS","priority":1,"timestamp":"2026-11-03T21:42:00.123Z"}'
      );
    });

    it('should match client canonical JSON with null location', () => {
      const aad = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
      };

      const canonical = canonicalJSON(aad);

      expect(canonical).toBe(
        '{"location":null,"locationStatus":"UNKNOWN","priority":1,"timestamp":"2026-11-03T21:42:00.123Z"}'
      );
    });
  });
});
