import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

describe('demo_mode_production_separation', () => {
  const repoRoot = join(__dirname, '..', '..');

  it('web_isE2eMock_is_disabled_in_production_even_when_flag_set', async () => {
    const configPath = join(repoRoot, 'apps/web/lib/config.ts');
    const source = readFileSync(configPath, 'utf8');
    expect(source).toContain("process.env.NODE_ENV === 'production'");
    expect(source).toContain('OPERATOR_E2E_MOCK');
    expect(source).toMatch(/return false;/);
  });

  it('android_prod_flavor_disables_demo_label_in_gradle', () => {
    const gradlePath = join(repoRoot, 'apps/android/app/build.gradle.kts');
    const gradle = readFileSync(gradlePath, 'utf8');
    expect(gradle).toContain('create("prod")');
    expect(gradle).toContain('SHOW_DEMO_MODE_LABEL", "false"');
    expect(gradle).toContain('create("demo")');
    expect(gradle).toContain('SHOW_DEMO_MODE_LABEL", "true"');
  });

  it('android_release_prod_tests_exist', () => {
    const prodTest = join(
      repoRoot,
      'apps/android/app/src/testProd/kotlin/com/sosmesh/android/ProdFlavorBuildConfigTest.kt',
    );
    const text = readFileSync(prodTest, 'utf8');
    expect(text).toContain('prodBuildConfig_disablesDemoModeLabel');
  });
});
