const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const COORD_PAIR_RE = /-?\d{1,3}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/g;
const JWT_LIKE_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const SENSITIVE_KEYS = new Set([
  'authorization',
  'token',
  'secret',
  'password',
  'encryptedpayload',
  'encryptednoteblob',
  'plaintext',
  'note',
  'latitude',
  'longitude',
  'coordinates',
  'sosmessage',
  'location',
  'phonenumber',
  'displayname',
  'email',
]);

export function redactLogString(value: string): string {
  let next = value;
  next = next.replace(JWT_LIKE_RE, '[redacted-token]');
  next = next.replace(EMAIL_RE, '[redacted-email]');
  next = next.replace(PHONE_RE, '[redacted-phone]');
  next = next.replace(COORD_PAIR_RE, '[redacted-coordinates]');
  return next;
}

export function redactLogValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return redactLogString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactLogValue(entry));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        continue;
      }
      out[key] = redactLogValue(nested);
    }
    return out;
  }
  return '[redacted]';
}

export function buildStructuredEvent(
  name: string,
  correlationId: string,
  fields: Record<string, unknown>
): Record<string, unknown> {
  return {
    event: name,
    correlationId,
    ts: new Date().toISOString(),
    ...((redactLogValue(fields) as Record<string, unknown>) ?? {}),
  };
}
