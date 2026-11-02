import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

/**
 * Supplementary Gradle/config evidence for demo vs prod separation.
 * Behavioral web proof: apps/web/lib/config.test.ts (isE2eMock).
 * Behavioral Android proof: ProdFlavorBuildConfigTest (NOT_TESTED until MacBook/Gradle prod CI).
 */
describe('demo_mode_production_separation_supplementary', () => {
  const repoRoot = join(__dirname, '..', '..');

  it('gradle_config_declares_prod_flavor_disables_demo_mode_label', () => {
    const gradle = readFileSync(join(repoRoot, 'apps/android/app/build.gradle.kts'), 'utf8');
    expect(gradle).toContain('create("prod")');
    expect(gradle).toContain('SHOW_DEMO_MODE_LABEL", "false"');
  });

  it('gradle_config_declares_demo_flavor_keeps_demo_label_for_internal_apks', () => {
    const gradle = readFileSync(join(repoRoot, 'apps/android/app/build.gradle.kts'), 'utf8');
    expect(gradle).toContain('create("demo")');
    expect(gradle).toContain('SHOW_DEMO_MODE_LABEL", "true"');
  });
});
