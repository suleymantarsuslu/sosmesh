import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('SosMesh brand tokens', () => {
  it('exposes navy and SOS red brand anchors in public tokens.css', () => {
    const css = fs.readFileSync(
      path.join(__dirname, '../public/tokens.css'),
      'utf8'
    );
    expect(css).toContain('--color-brand-navy: #070D1D');
    expect(css).toContain('--color-light-sos: #D32F2F');
    expect(css).toContain('--color-dark-surface-primary: #070D1D');
  });
});
