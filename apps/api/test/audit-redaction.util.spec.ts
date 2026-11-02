import {
  isCoordinateLikeNumber,
  redactAuditDetails,
} from '../src/privacy/audit-redaction.util';

describe('audit-redaction.util (unit)', () => {
  it('redacts known latitude/longitude keys regardless of casing', () => {
    const redacted = redactAuditDetails({
      Latitude: 39.931234,
      LNG: 32.836912,
    }) as Record<string, unknown>;
    expect(redacted.Latitude).toBe('[REDACTED]');
    expect(redacted.LNG).toBe('[REDACTED]');
    expect(JSON.stringify(redacted)).not.toContain('39.931');
  });

  it('redacts coordinate-like numbers under unknown keys', () => {
    const redacted = redactAuditDetails({
      envelope: { q: 39.925123, r: 32.836456 },
    }) as Record<string, Record<string, unknown>>;
    expect(redacted.envelope.q).toBe('[REDACTED_COORD]');
    expect(redacted.envelope.r).toBe('[REDACTED_COORD]');
    expect(JSON.stringify(redacted)).not.toContain('39.925');
    expect(JSON.stringify(redacted)).not.toContain('32.836');
  });

  it('redacts two-number coordinate arrays at any nesting depth', () => {
    const redacted = redactAuditDetails({
      trace: [{ path: [39.91, 32.84] }],
    }) as { trace: { path: unknown[] }[] };
    expect(redacted.trace[0].path).toEqual(['[REDACTED_COORD]', '[REDACTED_COORD]']);
  });

  it('redacts coords and location containers by key name', () => {
    const redacted = redactAuditDetails({
      coords: { lat: 39.9, lon: 32.8 },
      location: [41.0, 29.0],
    }) as Record<string, unknown>;
    expect(redacted.coords).toBe('[REDACTED]');
    expect(redacted.location).toBe('[REDACTED]');
  });

  it('preserves small integer counters that are not geographic', () => {
    const redacted = redactAuditDetails({
      messageCount: 3,
      hopCount: 2,
      priority: 4,
    }) as Record<string, number>;
    expect(redacted.messageCount).toBe(3);
    expect(redacted.hopCount).toBe(2);
    expect(redacted.priority).toBe(4);
  });

  it('isCoordinateLikeNumber matches decimals and high integer degrees only', () => {
    expect(isCoordinateLikeNumber(39.925)).toBe(true);
    expect(isCoordinateLikeNumber(32)).toBe(true);
    expect(isCoordinateLikeNumber(3)).toBe(false);
  });
});
