import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const pagePath = path.join(__dirname, '../app/page.tsx');

describe('marketing home page (/)', () => {
  it('does not expose the old implementation placeholder', () => {
    const src = fs.readFileSync(pagePath, 'utf8');
    expect(src).not.toMatch(/Implementation pending/i);
  });

  it('shows the branded logo and operator panel login entry point', () => {
    const src = fs.readFileSync(pagePath, 'utf8');
    expect(src).toContain('SosMeshLogo');
    expect(src).toContain('href="/operator/login"');
    expect(src).toContain('Operatör paneline giriş');
    expect(src).toContain('data-testid="marketing-operator-login"');
  });

  it('keeps the full 112 disclaimer meaning on the home page', () => {
    const src = fs.readFileSync(pagePath, 'utf8');
    expect(src).toContain('112 resmî acil çağrı hizmetinin yerine geçmez');
    expect(src).toContain('Deneysel bir acil durum haberleşme mesh ağı prototipidir');
  });
});
