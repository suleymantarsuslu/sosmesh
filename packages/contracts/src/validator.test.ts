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
