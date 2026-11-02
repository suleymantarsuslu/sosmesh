/**
 * Best-effort redaction before optional cloud AI classification.
 * Does not replace lawful basis or user consent for real SOS content (see model-card).
 */

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g;
const COORD_PAIR_RE = /\b-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g;

export function deidentifySosPlaintextForPrompt(plaintext: string): string {
  let next = plaintext;
  next = next.replace(EMAIL_RE, '[redacted-email]');
  next = next.replace(PHONE_RE, '[redacted-phone]');
  next = next.replace(COORD_PAIR_RE, '[redacted-coordinates]');
  return next;
}
