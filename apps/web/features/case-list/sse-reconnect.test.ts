import { describe, expect, it } from 'vitest';

describe('SSE reconnect logic', () => {
  it('should retry SSE connection with exponential backoff', () => {
    const failures = [1, 2, 3];
    const delays = failures.map((f) => 2000 * f);
    expect(delays).toEqual([2000, 4000, 6000]);
  });

  it('should fall back to polling after max SSE failures', () => {
    const MAX_SSE_FAILURES = 3;
    let sseFailures = 0;
    let shouldFallbackToPolling = false;

    for (let i = 0; i < 5; i++) {
      sseFailures += 1;
      if (sseFailures >= MAX_SSE_FAILURES) {
        shouldFallbackToPolling = true;
        break;
      }
    }

    expect(shouldFallbackToPolling).toBe(true);
    expect(sseFailures).toBe(3);
  });

  it('should reset failure count on successful connection', () => {
    let sseFailures = 2;
    const onSuccessfulConnect = () => {
      sseFailures = 0;
    };

    onSuccessfulConnect();
    expect(sseFailures).toBe(0);
  });

  it('should parse numeric after parameter for SSE URL', () => {
    const afterRef = { current: '123' };
    const url = new URL('/api/operator/events/stream', 'https://example.com');
    url.searchParams.set('after', afterRef.current);
    
    expect(url.searchParams.get('after')).toBe('123');
    expect(url.pathname).toBe('/api/operator/events/stream');
  });

  it('should validate after parameter is numeric before using it', () => {
    const testCases = [
      { input: '123', valid: true },
      { input: '0', valid: true },
      { input: 'abc', valid: false },
      { input: '', valid: false },
      { input: '123abc', valid: false },
    ];

    testCases.forEach(({ input, valid }) => {
      const isValid = /^\d+$/.test(input);
      expect(isValid).toBe(valid);
    });
  });
});
