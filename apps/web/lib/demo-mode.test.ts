import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('DemoModeBanner', () => {
  it('uses visible DEMO MODE label copy', () => {
    const src = readFileSync(`${__dirname}/../components/operator/DemoModeBanner.tsx`, 'utf8');
    expect(src).toContain('data-testid="demo-mode-banner"');
    expect(src).toContain('DEMO MODE');
    expect(src).toContain('gerçek acil durum kaydı değildir');
  });
});
