import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = join(__dirname, '../../../..');

function parseLocalizableKeys(relativePath: string): Set<string> {
  const content = readFileSync(join(repoRoot, relativePath), 'utf8');
  const keys = new Set<string>();
  const lineRe = /^"([^"\\]*(?:\\.[^"\\]*)*)"\s*=/;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }
    const match = trimmed.match(lineRe);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

describe('iOS Localizable.strings parity', () => {
  it('tr and en help keys match', () => {
    const trKeys = parseLocalizableKeys(
      'apps/ios/SOSMesh/tr.lproj/Localizable.strings'
    );
    const enKeys = parseLocalizableKeys(
      'apps/ios/SOSMesh/en.lproj/Localizable.strings'
    );
    expect([...trKeys].sort()).toEqual([...enKeys].sort());
  });

  it('includes 112 disclaimer in help.not112 for both locales', () => {
    for (const locale of ['tr', 'en'] as const) {
      const file = readFileSync(
        join(
          repoRoot,
          `apps/ios/SOSMesh/${locale}.lproj/Localizable.strings`
        ),
        'utf8'
      );
      const match = file.match(/"help\.not112"\s*=\s*"([^"]*)"/);
      expect(match?.[1] ?? '').toMatch(/112/);
    }
  });
});
