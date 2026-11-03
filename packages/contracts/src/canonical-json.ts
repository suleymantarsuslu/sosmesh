/**
 * Recursive key sort for deterministic JSON (matches legacy createAAD sortKeys).
 */
export function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);

  const record = obj as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  Object.keys(record)
    .sort()
    .forEach((key) => {
      sorted[key] = sortKeys(record[key]);
    });
  return sorted;
}

/** Canonical JSON: sorted keys at every object level, then `JSON.stringify` (no whitespace). */
export function canonicalJSON(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}
