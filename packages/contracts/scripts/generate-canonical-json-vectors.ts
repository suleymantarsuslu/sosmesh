import * as fs from 'fs';
import * as path from 'path';
import { buildCanonicalJsonVectorCases } from '../src/canonical-json-fixture.js';

function main(): void {
  const cases = buildCanonicalJsonVectorCases();
  const outPath = path.join(__dirname, '../test-vectors/canonical-json-001.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(cases, null, 2)}\n`);
  console.log(`Wrote ${cases.length} cases to ${outPath}`);
}

main();
