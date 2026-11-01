const FORBIDDEN_ENVELOPE_KEYS = new Set(['text', 'message', 'note', 'body']);

export function findForbiddenEnvelopeFieldKey(envelope: Record<string, unknown>): string | null {
  for (const key of Object.keys(envelope)) {
    const lower = key.toLowerCase();
    if (lower.startsWith('plaintext') || FORBIDDEN_ENVELOPE_KEYS.has(lower)) {
      return key;
    }
  }
  return null;
}
