import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { buildValidIngestRequest } from '../../../apps/api/test/helpers/build-ingest-packet';
import { applyTestIngestEnv } from '../../../apps/api/test/helpers/ingest-test-env';

applyTestIngestEnv();

const count = Number(process.argv[2] ?? '100');
const outPath = process.argv[3];
if (!outPath || !Number.isFinite(count) || count < 1) {
  process.stderr.write('Usage: generate-ingest-payloads.ts <count> <output.json>\n');
  process.exit(1);
}

const items = Array.from({ length: count }, () =>
  buildValidIngestRequest({ messageId: randomUUID() })
);
writeFileSync(outPath, JSON.stringify(items));
process.stdout.write(`Wrote ${count} payloads to ${outPath}\n`);
