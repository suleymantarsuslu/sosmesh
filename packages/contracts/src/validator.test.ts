import { describe, it, expect } from 'vitest';
import { validateSosMessage } from './validator';
import * as fs from 'fs';
import * as path from 'path';

const fixturesDir = path.join(__dirname, '../../fixtures/protocol-v1');

describe('SOS Message Validation', () => {
  it('should validate valid SOS message', () => {
    const validSos = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'valid-sos.json'), 'utf-8')
    );
    const result = validateSosMessage(validSos);
    expect(result.valid).toBe(true);
  });

  it('should validate unicode SOS message', () => {
    const unicodeSos = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'unicode-sos.json'), 'utf-8')
    );
    const result = validateSosMessage(unicodeSos);
    expect(result.valid).toBe(true);
  });

  it('should validate unknown-location SOS message without coordinates', () => {
    const unknownSos = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'unknown-location-sos.json'), 'utf-8')
    );
    const result = validateSosMessage(unknownSos);
    expect(result.valid).toBe(true);
    expect(unknownSos.envelope.locationStatus).toBe('UNKNOWN');
    expect(unknownSos.envelope.location).toBeNull();
  });

  it('should reject UNKNOWN locationStatus with Null Island coordinates', () => {
    const nullIsland = {
      version: 1,
      id: '990e8400-e29b-41d4-a716-446655440004',
      envelope: {
        timestamp: '2026-10-29T20:00:00Z',
        locationStatus: 'UNKNOWN',
        location: { latitude: 0, longitude: 0 },
        priority: 1,
        ackLevel: 'DEVICE_STORED',
      },
      encryptedPayload: 'PAYLOAD',
    };
    const result = validateSosMessage(nullIsland);
    expect(result.valid).toBe(false);
  });

  it('should reject GPS locationStatus without location object', () => {
    const missingCoords = {
      version: 1,
      id: 'aa0e8400-e29b-41d4-a716-446655440005',
      envelope: {
        timestamp: '2026-10-29T20:30:00Z',
        locationStatus: 'GPS',
        location: null,
        priority: 1,
        ackLevel: 'DEVICE_STORED',
      },
      encryptedPayload: 'PAYLOAD',
    };
    const result = validateSosMessage(missingCoords);
    expect(result.valid).toBe(false);
  });

  it('should reject invalid message with missing field', () => {
    const invalidSos = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'invalid-missing-field.json'), 'utf-8')
    );
    const result = validateSosMessage(invalidSos);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('longitude');
  });

  it('should reject invalid timestamp', () => {
    const invalidTimestamp = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'invalid-bad-timestamp.json'), 'utf-8')
    );
    const result = validateSosMessage(invalidTimestamp);
    expect(result.valid).toBe(false);
  });

  it('should serialize and deserialize maintaining structure', () => {
    const validSos = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'valid-sos.json'), 'utf-8')
    );
    const serialized = JSON.stringify(validSos);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(validSos);
    const result = validateSosMessage(deserialized);
    expect(result.valid).toBe(true);
  });
});
