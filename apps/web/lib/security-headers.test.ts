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

  it('includes worker-src and child-src for MapLibre blob workers', () => {
    const csp = securityHeaders.find((row) => row.key === 'Content-Security-Policy');
    expect(csp?.value).toContain("worker-src 'self' blob:");
    expect(csp?.value).toContain('child-src blob:');
  });

  it('includes tile origin in connect-src for MapLibre tile fetching', () => {
    const csp = securityHeaders.find((row) => row.key === 'Content-Security-Policy');
    expect(csp?.value).toMatch(/connect-src [^;]*https:\/\/tile\.openstreetmap\.org/);
  });

  it('does not include localhost in production CSP', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    delete require.cache[require.resolve('./security-headers.js')];
    const { securityHeaders: prodHeaders } = require('./security-headers.js') as {
      securityHeaders: { key: string; value: string }[];
    };
    
    const csp = prodHeaders.find((row) => row.key === 'Content-Security-Policy');
    expect(csp?.value).not.toContain('http://localhost:*');
    
    process.env.NODE_ENV = originalEnv;
  });
});
