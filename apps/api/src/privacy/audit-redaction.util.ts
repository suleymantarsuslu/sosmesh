import { Prisma } from '@prisma/client';

const SENSITIVE_DETAIL_KEYS = new Set([
  'latitude',
  'longitude',
  'accuracyMeters',
  'operatorDisplayText',
  'encryptedNoteBlob',
  'encryptedPayloadRef',
  'note',
  'plaintext',
  'message',
  'coordinates',
  'sosText',
]);

const COORD_PATTERN = /^-?\d{1,3}\.\d{3,}/;

function redactString(value: string): string {
  if (COORD_PATTERN.test(value.trim())) {
    return '[REDACTED_COORD]';
  }
  if (value.length > 80) {
    return '[REDACTED_TEXT]';
  }
  return value;
}

export function redactAuditDetails(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (typeof value === 'number') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactAuditDetails(entry));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_DETAIL_KEYS.has(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactAuditDetails(nested);
      }
    }
    return out;
  }
  return value;
}

export function auditDetailsForWrite(details: Record<string, unknown>): Prisma.InputJsonValue {
  return redactAuditDetails(details) as Prisma.InputJsonValue;
}
