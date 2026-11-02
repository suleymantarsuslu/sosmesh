import { Prisma } from '@prisma/client';

const SENSITIVE_DETAIL_KEYS = new Set([
  'latitude',
  'longitude',
  'lat',
  'lng',
  'lon',
  'accuracymeters',
  'operatordisplaytext',
  'encryptednoteblob',
  'encryptedpayloadref',
  'note',
  'plaintext',
  'message',
  'coordinates',
  'coords',
  'location',
  'sostext',
]);

const COORD_PATTERN = /^-?\d{1,3}\.\d{3,}/;

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function isSensitiveDetailKey(key: string): boolean {
  return SENSITIVE_DETAIL_KEYS.has(normalizeKey(key));
}

/** Decimal or plausible integer degree value in geographic range (avoids small counters like hopCount). */
export function isCoordinateLikeNumber(value: number): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  if (Math.abs(value) > 180) {
    return false;
  }
  if (!Number.isInteger(value)) {
    return true;
  }
  return Math.abs(value) >= 20 && Math.abs(value) <= 180;
}

function redactString(value: string): string {
  if (COORD_PATTERN.test(value.trim())) {
    return '[REDACTED_COORD]';
  }
  if (value.length > 80) {
    return '[REDACTED_TEXT]';
  }
  return value;
}

function redactNumber(value: number): unknown {
  return isCoordinateLikeNumber(value) ? '[REDACTED_COORD]' : value;
}

function redactArray(values: unknown[]): unknown[] {
  if (
    values.length === 2 &&
    typeof values[0] === 'number' &&
    typeof values[1] === 'number' &&
    isCoordinateLikeNumber(values[0]) &&
    isCoordinateLikeNumber(values[1])
  ) {
    return ['[REDACTED_COORD]', '[REDACTED_COORD]'];
  }
  return values.map((entry) => redactAuditDetails(entry));
}

export function redactAuditDetails(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (typeof value === 'number') {
    return redactNumber(value);
  }
  if (Array.isArray(value)) {
    return redactArray(value);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveDetailKey(key)) {
        out[key] = '[REDACTED]';
      } else if (typeof nested === 'number') {
        out[key] = redactNumber(nested);
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
