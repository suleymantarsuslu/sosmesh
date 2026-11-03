import { sortKeys } from './canonical-json.js';

export const CANONICAL_JSON_UTF16_STRING_TAG = '__canonicalJsonUtf16String';

export interface CanonicalJsonVectorCase {
  name: string;
  input: unknown;
  expected: string;
}

export interface CanonicalJsonVectorFileCase {
  name: string;
  input: unknown;
  expected: string;
}

/** Same bytes as `createAAD` JSON: `JSON.stringify(sortKeys(value))` (`crypto.ts` imports this `sortKeys`). */
export function expectedCanonicalJSON(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function stringToUtf16CodeUnits(value: string): number[] {
  const units: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    units.push(value.charCodeAt(i));
  }
  return units;
}

function utf16CodeUnitsToString(units: number[]): string {
  let out = '';
  for (const unit of units) {
    out += String.fromCharCode(unit);
  }
  return out;
}

/** True when the string contains an unpaired UTF-16 surrogate (invalid in strict JSON / Foundation). */
export function stringContainsLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (i + 1 >= value.length) {
        return true;
      }
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      i += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/** Encode logical input for a JSON fixture file Foundation / strict JSON can parse. */
export function encodeInputForFixtureFile(input: unknown): unknown {
  if (typeof input === 'string') {
    if (stringContainsLoneSurrogate(input)) {
      return { [CANONICAL_JSON_UTF16_STRING_TAG]: stringToUtf16CodeUnits(input) };
    }
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(encodeInputForFixtureFile);
  }
  if (input !== null && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      out[key] = encodeInputForFixtureFile(record[key]);
    }
    return out;
  }
  return input;
}

/** Decode fixture file `input` back to the logical value used for canonical JSON. */
export function decodeInputFromFixtureFile(encoded: unknown): unknown {
  if (encoded !== null && typeof encoded === 'object' && !Array.isArray(encoded)) {
    const record = encoded as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 1 && keys[0] === CANONICAL_JSON_UTF16_STRING_TAG) {
      const units = record[CANONICAL_JSON_UTF16_STRING_TAG];
      if (!Array.isArray(units)) {
        throw new Error('Invalid __canonicalJsonUtf16String payload');
      }
      return utf16CodeUnitsToString(units as number[]);
    }
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = decodeInputFromFixtureFile(record[key]);
    }
    return out;
  }
  if (Array.isArray(encoded)) {
    return encoded.map(decodeInputFromFixtureFile);
  }
  return encoded;
}

export function buildCanonicalJsonVectorCasesForFile(): CanonicalJsonVectorFileCase[] {
  return buildCanonicalJsonVectorCases().map(({ name, input, expected }) => ({
    name,
    input: encodeInputForFixtureFile(input),
    expected,
  }));
}

/** Cases for cross-language canonical JSON (oracle = Node `createAAD` sort + stringify). */
export function buildCanonicalJsonVectorCases(): CanonicalJsonVectorCase[] {
  const escapeStringValue =
    '" \\ \n \t \r \b \f \u0001 \u001f / ğüşıöçİ 😀';

  const keyQuote = '"key"';
  const keyBackslash = 'back\\slash';
  const keyNewline = 'line\nbreak';
  const keyTurkish = 'ğüşı';
  const keyEmoji = '😀key';

  const astralKey = '\u{10000}';
  const bmpHighKey = '\uFFFF';

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
    { name: 'string-lone-surrogate', input: '\uD800' },
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
      name: 'key-order-ffff-vs-astral',
      input: { [bmpHighKey]: 1, [astralKey]: 2, a: 3 },
    },
    {
      name: 'int-vs-bool-fields',
      input: { version: 1, enabled: true, hopCount: 0, ttl: 300 },
    },
  ];

  return inputs.map(({ name, input }) => ({
    name,
    input,
    expected: expectedCanonicalJSON(input),
  }));
}
