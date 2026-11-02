import { canonicalJSON } from './canonical-json.js';

export interface CanonicalJsonVectorCase {
  name: string;
  input: unknown;
  expected: string;
}

/** Cases for cross-language canonical JSON (oracle = Node JSON.stringify after sortKeys). */
export function buildCanonicalJsonVectorCases(): CanonicalJsonVectorCase[] {
  const escapeStringValue =
    '" \\ \n \t \r \b \f \u0001 \u001f / ğüşıöçİ 😀';

  const keyQuote = '"key"';
  const keyBackslash = 'back\\slash';
  const keyNewline = 'line\nbreak';
  const keyTurkish = 'ğüşı';
  const keyEmoji = '😀key';

  const inputs: { name: string; input: unknown }[] = [
    { name: 'number-zero', input: 0 },
    { name: 'number-one', input: 1 },
    { name: 'number-minus-one', input: -1 },
    { name: 'number-one-point-five', input: 1.5 },
    { name: 'number-zero-point-one', input: 0.1 },
    { name: 'number-1e21', input: 1e21 },
    { name: 'number-1e-7', input: 1e-7 },
    { name: 'number-large-int', input: 123456789012 },
    { name: 'number-negative-zero', input: -0 },
    { name: 'bool-true', input: true },
    { name: 'bool-false', input: false },
    { name: 'null', input: null },
    { name: 'empty-object', input: {} },
    { name: 'empty-array', input: [] },
    {
      name: 'nested-object-array',
      input: { z: [{ nested: true }, null], a: { inner: [1, 'x'] } },
    },
    { name: 'string-escapes', input: escapeStringValue },
    {
      name: 'object-special-keys',
      input: {
        [keyQuote]: 1,
        [keyBackslash]: 2,
        [keyNewline]: 3,
        [keyTurkish]: 4,
        [keyEmoji]: 5,
      },
    },
    {
      name: 'key-order-utf16',
      input: { b: 1, a: 2, B: 3, ä: 4, 'Ｚ': 5, '😀': 6 },
    },
    {
      name: 'int-vs-bool-fields',
      input: { version: 1, enabled: true, hopCount: 0, ttl: 300 },
    },
  ];

  return inputs.map(({ name, input }) => ({
    name,
    input,
    expected: canonicalJSON(input),
  }));
}
