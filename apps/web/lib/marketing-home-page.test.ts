import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const marketingComponentPath = path.join(
  __dirname,
  '../components/marketing/MarketingHome.tsx'
);

describe('marketing home page (/)', () => {
  it('does not expose the old implementation placeholder', () => {
    const src = fs.readFileSync(marketingComponentPath, 'utf8');
    expect(src).not.toMatch(/Implementation pending/i);
  });

  it('uses i18n keys instead of hardcoded locale strings', () => {
    const src = fs.readFileSync(marketingComponentPath, 'utf8');
    expect(src).toContain("t('web.marketing.operatorLoginCta')");
    expect(src).toContain("t('web.marketing.not112Body')");
    expect(src).toContain('data-testid="marketing-operator-login"');
    expect(src).not.toMatch(/Operatör paneline giriş/);
  });

  it('includes locale switcher and operator login link target', () => {
    const src = fs.readFileSync(marketingComponentPath, 'utf8');
    expect(src).toContain('LocaleSwitcher');
    expect(src).toContain('href="/operator/login"');
  });
});
