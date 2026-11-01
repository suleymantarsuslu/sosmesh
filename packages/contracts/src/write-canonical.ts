import * as fs from 'fs';
import * as path from 'path';

const fixturesDir = path.join(__dirname, '../../fixtures/protocol-v1');
const outputDir = path.join(__dirname, '../build/canonical-json');

fs.mkdirSync(outputDir, { recursive: true });

const fixtures = ['valid-sos.json', 'unicode-sos.json', 'unknown-location-sos.json'];

fixtures.forEach(fixture => {
  const content = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixture), 'utf-8'));
  const canonical = JSON.stringify(content);
  const outputName = fixture.replace('.json', '-typescript.json');
  fs.writeFileSync(path.join(outputDir, outputName), canonical);
  console.log(`✓ Written ${outputName}`);
});

console.log('✓ Canonical JSON outputs written to build/canonical-json/');
