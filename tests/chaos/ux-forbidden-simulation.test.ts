import { execSync } from 'child_process';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

describe('chaos_ux_forbidden_simulation_device_copy', () => {
  it('chaos_ux_forbidden_copy_rejects_simulation_as_real_device_wording', () => {
    const repoRoot = join(__dirname, '..', '..');
    const output = execSync('node scripts/ux-forbidden-copy.js', {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    expect(output).toContain('Yasak ifade bulunamadı');
  });
});
