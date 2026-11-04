import { decideSenderRate, SENDER_HARD_LIMIT_PER_HOUR, SENDER_BURST_ALLOWANCE } from '../src/mesh-v2/sender-rate-limit';

describe('decideSenderRate', () => {
  const now = new Date('2024-01-01T12:00:00Z');
  const hourAgo = new Date(now.getTime() - 3_600_000);

  it('accepts messages below hard limit', () => {
    const decision = decideSenderRate(59, hourAgo, now);
    expect(decision.action).toBe('accept');
  });

  it('rejects at hard limit without real content', () => {
    const decision = decideSenderRate(60, hourAgo, now, false);
    expect(decision.action).toBe('reject');
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('accepts at hard limit with real content via burst allowance', () => {
    const decision = decideSenderRate(60, hourAgo, now, true);
    expect(decision.action).toBe('accept');
  });

  it('rejects above hard limit plus burst', () => {
    const decision = decideSenderRate(SENDER_HARD_LIMIT_PER_HOUR + SENDER_BURST_ALLOWANCE, hourAgo, now, true);
    expect(decision.action).toBe('reject');
  });

  it('computes accurate retry-after based on oldest message', () => {
    const oldest = new Date(now.getTime() - 2_700_000);
    const decision = decideSenderRate(60, oldest, now, false);
    expect(decision.action).toBe('reject');
    expect(decision.retryAfterSeconds).toBeGreaterThan(850);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(900);
  });

  it('computes retry-after when oldest is recent', () => {
    const oldest = new Date(now.getTime() - 100_000);
    const decision = decideSenderRate(60, oldest, now, false);
    expect(decision.action).toBe('reject');
    expect(decision.retryAfterSeconds).toBeGreaterThan(3400);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });
});
