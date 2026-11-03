/** Shared security response headers for the operator web app (ADIM 43). */

/**
 * Derive allowed tile origins from NEXT_PUBLIC_MAP_TILE_URL for CSP connect-src.
 * MapLibre fetches tiles via fetch/XHR, so the tile URL origin must be allowed.
 * Returns production-safe origins; localhost is dev-only.
 */
function tileOrigins() {
  const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  try {
    const url = new URL(tileUrl.replace(/{z}|{x}|{y}/g, '0'));
    return url.origin;
  } catch {
    return 'https://tile.openstreetmap.org';
  }
}

function buildCSP() {
  const isDev = process.env.NODE_ENV !== 'production';
  const tileOrigin = tileOrigins();
  
  const connectSrc = [
    "'self'",
    'ws:',
    'wss:',
    tileOrigin
  ];
  
  if (isDev) {
    connectSrc.push('http://localhost:*');
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${tileOrigin}`,
    `connect-src ${connectSrc.join(' ')}`,
    "worker-src 'self' blob:",
    "child-src blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Content-Security-Policy',
    value: buildCSP(),
  },
];

module.exports = { securityHeaders };
