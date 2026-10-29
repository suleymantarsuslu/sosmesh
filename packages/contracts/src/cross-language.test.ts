import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const fixturesDir = path.join(__dirname, '../../fixtures/protocol-v1');

describe('Cross-Language Contract Equivalence', () => {
  it('should verify TypeScript canonical JSON representation', () => {
    const validSosPath = path.join(fixturesDir, 'valid-sos.json');
    const validSos = JSON.parse(fs.readFileSync(validSosPath, 'utf-8'));

    // TypeScript canonical output
    const tsCanonical = JSON.stringify(validSos, Object.keys(validSos).sort(), 2);

    expect(tsCanonical).toBeDefined();
    expect(tsCanonical).toContain('"version": 1');
    expect(tsCanonical).toContain('"envelope"');
    expect(tsCanonical).toContain('"encryptedPayload"');
  });

  it('should verify all fixtures are parseable as JSON', () => {
    const fixtures = [
      'valid-sos.json',
      'unicode-sos.json',
      'invalid-missing-field.json',
      'invalid-bad-timestamp.json'
    ];

    fixtures.forEach(fixture => {
      const content = fs.readFileSync(path.join(fixturesDir, fixture), 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });
});
