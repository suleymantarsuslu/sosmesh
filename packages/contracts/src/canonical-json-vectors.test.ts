import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildCanonicalJsonVectorCases,
  buildCanonicalJsonVectorCasesForFile,
  decodeInputFromFixtureFile,
  expectedCanonicalJSON,
  type CanonicalJsonVectorFileCase,
} from './canonical-json-fixture.js';
import { sortKeys } from './crypto.js';

const fixturePath = path.join(__dirname, '../test-vectors/canonical-json-001.json');

describe('canonical-json-001 fixture', () => {
  it('committed file matches in-memory regeneration (byte-for-byte)', () => {
    const logical = buildCanonicalJsonVectorCases();
    const regenerated = buildCanonicalJsonVectorCasesForFile();
    const committedRaw = fs.readFileSync(fixturePath, 'utf-8');
    const committed = JSON.parse(committedRaw) as CanonicalJsonVectorFileCase[];

    expect(regenerated).toHaveLength(committed.length);
    expect(logical).toHaveLength(committed.length);
    for (let i = 0; i < logical.length; i += 1) {
      expect(regenerated[i].name).toBe(committed[i].name);
      expect(regenerated[i].expected).toBe(committed[i].expected);
      expect(expectedCanonicalJSON(logical[i].input)).toBe(committed[i].expected);
      expect(JSON.stringify(sortKeys(logical[i].input))).toBe(committed[i].expected);

      const decoded = decodeInputFromFixtureFile(committed[i].input);
      expect(expectedCanonicalJSON(decoded)).toBe(committed[i].expected);
    }

    const regeneratedJson = `${JSON.stringify(regenerated, null, 2)}\n`;
    expect(regeneratedJson).toBe(committedRaw);
  });
});
