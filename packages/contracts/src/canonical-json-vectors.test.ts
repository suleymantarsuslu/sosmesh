import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildCanonicalJsonVectorCases,
  type CanonicalJsonVectorCase,
} from '../scripts/generate-canonical-json-vectors';
import { canonicalJSON } from './canonical-json';

const fixturePath = path.join(__dirname, '../test-vectors/canonical-json-001.json');

describe('canonical-json-001 fixture', () => {
  it('committed file matches in-memory regeneration (byte-for-byte)', () => {
    const regenerated = buildCanonicalJsonVectorCases();
    const committedRaw = fs.readFileSync(fixturePath, 'utf-8');
    const committed = JSON.parse(committedRaw) as CanonicalJsonVectorCase[];

    expect(regenerated).toHaveLength(committed.length);
    for (let i = 0; i < regenerated.length; i++) {
      expect(regenerated[i].name).toBe(committed[i].name);
      expect(regenerated[i].expected).toBe(committed[i].expected);
      expect(canonicalJSON(regenerated[i].input)).toBe(committed[i].expected);
    }

    const regeneratedJson = `${JSON.stringify(regenerated, null, 2)}\n`;
    expect(regeneratedJson).toBe(committedRaw);
  });
});
