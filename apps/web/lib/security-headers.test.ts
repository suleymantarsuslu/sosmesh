import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { securityHeaders } = require('./security-headers.js') as {
  securityHeaders: { key: string; value: string }[];
};
const nextConfig = require('../next.config.js') as {
  headers: () => Promise<{ source: string; headers: { key: string }[] }[]>;
};

describe('ADIM 43 web security headers', () => {
  it('exports CSP and clickjacking protections for operator routes', () => {
    expect(securityHeaders).toBeDefined();
    const keys = securityHeaders.map((row) => row.key);
    expect(keys).toContain('Content-Security-Policy');
    expect(keys).toContain('X-Frame-Options');
    const csp = securityHeaders.find((row) => row.key === 'Content-Security-Policy');
    expect(csp?.value).toContain("frame-ancestors 'none'");
  });

  it('registers headers() hook on Next config', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const routes = await nextConfig.headers();
    expect(routes[0].source).toBe('/:path*');
    expect(routes[0].headers.length).toBeGreaterThanOrEqual(4);
  });
});
