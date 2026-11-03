import { extractClientAad, isLegacyWholeEnvelopeAad, extractClientAadFromLegacy } from './envelope-aad-builder';
import { canonicalJSON, encryptPayload, decryptPayload } from '@sosmesh/contracts';

describe('envelope-aad-builder', () => {
  const testConfig = {
    keyId: 'test-key-001',
    serverPublicKey: 'M8tCMh3Xzp8jG6F2K7JvnX1A9cD3LqZwE5Y4bT8mN0Q=',
    serverPrivateKey: 'OHV0FGQrp8sJ9x5Ew2Z3T6K7bN1A8cD4G5mF9qY0Lz8=',
  };

  describe('extractClientAad', () => {
    it('should extract client AAD fields from wire envelope without location', () => {
      const wireEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
        ackLevel: 'DEVICE_STORED',
        relayCount: 0,
      };

      const clientAad = extractClientAad(wireEnvelope);

      expect(clientAad).toEqual({
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
      });
    });

    it('should extract client AAD fields from wire envelope with coarse GPS location', () => {
      const wireEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'GPS',
        location: {
          latitude: 41.01,
          longitude: 28.98,
          accuracy: 1000,
        },
        priority: 1,
        ackLevel: 'PEER_RECEIVED',
        relayCount: 2,
      };

      const clientAad = extractClientAad(wireEnvelope);

      expect(clientAad).toEqual({
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'GPS',
        location: {
          latitude: 41.01,
          longitude: 28.98,
          accuracy: 1000,
        },
        priority: 1,
      });
    });

    it('should extract client AAD without accuracy when not present', () => {
      const wireEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'MANUAL',
        location: {
          latitude: 41.01,
          longitude: 28.98,
        },
        priority: 2,
        ackLevel: 'SERVER_ACCEPTED',
        relayCount: 1,
      };

      const clientAad = extractClientAad(wireEnvelope);

      expect(clientAad).toEqual({
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'MANUAL',
        location: {
          latitude: 41.01,
          longitude: 28.98,
        },
        priority: 2,
      });
    });

    it('should default priority to 1 when missing', () => {
      const wireEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
      };

      const clientAad = extractClientAad(wireEnvelope);

      expect(clientAad.priority).toBe(1);
    });

    it('should convert location to null when absent', () => {
      const wireEnvelope = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        priority: 1,
      };

      const clientAad = extractClientAad(wireEnvelope);

      expect(clientAad.location).toBeNull();
    });
  });

  describe('isLegacyWholeEnvelopeAad', () => {
    it('should detect legacy AAD with ackLevel', () => {
      const legacyAad = JSON.stringify({
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        priority: 1,
        ackLevel: 'DEVICE_STORED',
        relayCount: 0,
      });

      expect(isLegacyWholeEnvelopeAad(legacyAad)).toBe(true);
    });

    it('should detect legacy AAD with relayCount', () => {
      const legacyAad = JSON.stringify({
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
        relayCount: 2,
      });

      expect(isLegacyWholeEnvelopeAad(legacyAad)).toBe(true);
    });

    it('should not flag new format AAD as legacy', () => {
      const newAad = JSON.stringify({
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
      });

      expect(isLegacyWholeEnvelopeAad(newAad)).toBe(false);
    });

    it('should handle invalid JSON gracefully', () => {
      expect(isLegacyWholeEnvelopeAad('not json')).toBe(false);
    });
  });

  describe('extractClientAadFromLegacy', () => {
    it('should extract client AAD from legacy format', () => {
      const legacyAad = JSON.stringify({
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'GPS',
        location: {
          latitude: 41.01,
          longitude: 28.98,
          accuracy: 1000,
        },
        priority: 1,
        ackLevel: 'SERVER_ACCEPTED',
        relayCount: 3,
      });

      const extracted = extractClientAadFromLegacy(legacyAad);

      expect(extracted).toEqual({
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'GPS',
        location: {
          latitude: 41.01,
          longitude: 28.98,
          accuracy: 1000,
        },
        priority: 1,
      });
    });

    it('should return null for invalid JSON', () => {
      expect(extractClientAadFromLegacy('not json')).toBeNull();
    });
  });

  describe('Real crypto round-trip tests', () => {
    it('should decrypt message encrypted with client AAD (no location)', () => {
      const clientAad = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
      };

      const payload = {
        sos_type: 'GENERAL',
        note: 'Help needed!',
        language: 'en',
      };

      const encrypted = encryptPayload(payload, clientAad, testConfig);
      const decrypted = decryptPayload(encrypted, clientAad, testConfig);

      expect(decrypted.note).toBe('Help needed!');
    });

    it('should decrypt message encrypted with client AAD (with GPS location)', () => {
      const clientAad = {
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
        note: 'Help at GPS location!',
        location: {
          latitude: 41.008234,
          longitude: 28.978456,
          accuracy_meters: 15.5,
          timestamp: '2026-11-03T21:42:00.123Z',
        },
        language: 'en',
      };

      const encrypted = encryptPayload(payload, clientAad, testConfig);
      const decrypted = decryptPayload(encrypted, clientAad, testConfig);

      expect(decrypted.note).toBe('Help at GPS location!');
      expect(decrypted.location.latitude).toBe(41.008234);
    });

    it('should FAIL to decrypt when wire envelope includes ackLevel/relayCount', () => {
      const clientAad = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'UNKNOWN',
        location: null,
        priority: 1,
      };

      const wireEnvelope = {
        ...clientAad,
        ackLevel: 'DEVICE_STORED',
        relayCount: 0,
      };

      const payload = {
        sos_type: 'GENERAL',
        note: 'This will fail',
        language: 'en',
      };

      const encrypted = encryptPayload(payload, clientAad, testConfig);

      expect(() => {
        decryptPayload(encrypted, wireEnvelope, testConfig);
      }).toThrow('DECRYPTION_FAILED');
    });

    it('should decrypt legacy stored AAD after extraction', () => {
      const clientAad = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'GPS',
        location: {
          latitude: 41.01,
          longitude: 28.98,
        },
        priority: 1,
      };

      const payload = {
        sos_type: 'GENERAL',
        note: 'Legacy row decryption',
        language: 'en',
      };

      const encrypted = encryptPayload(payload, clientAad, testConfig);

      const legacyStoredAad = canonicalJSON({
        ...clientAad,
        ackLevel: 'SERVER_ACCEPTED',
        relayCount: 2,
      });

      const extractedAad = extractClientAadFromLegacy(legacyStoredAad);
      expect(extractedAad).not.toBeNull();

      const decrypted = decryptPayload(encrypted, extractedAad!, testConfig);
      expect(decrypted.note).toBe('Legacy row decryption');
    });

    it('should match canonical JSON key order between client and server', () => {
      const clientAad = {
        timestamp: '2026-11-03T21:42:00.123Z',
        locationStatus: 'GPS',
        location: {
          latitude: 41.01,
          longitude: 28.98,
          accuracy: 1000,
        },
        priority: 1,
      };

      const canonical = canonicalJSON(clientAad);
      const parsed = JSON.parse(canonical);

      const keys = Object.keys(parsed);
      expect(keys).toEqual(['location', 'locationStatus', 'priority', 'timestamp']);

      const locationKeys = Object.keys(parsed.location);
      expect(locationKeys).toEqual(['accuracy', 'latitude', 'longitude']);
    });
  });
});
