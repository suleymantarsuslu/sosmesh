import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

describe('false_green_confidence_gates', () => {
  const repoRoot = join(__dirname, '..', '..');

  it('forbidden_copy_scan_still_passes', () => {
    const output = execSync('node scripts/ux-forbidden-copy.js', {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    expect(output).toContain('Yasak ifade bulunamadı');
  });

  it('android_relay_upload_failure_test_exists', () => {
    const kotlin = readFileSync(
      join(repoRoot, 'apps/android/feature-relay/src/test/kotlin/com/sosmesh/android/feature/relay/RelayUploadExecutorTest.kt'),
      'utf-8'
    );
    expect(kotlin).toContain('http500_keepsLocalSavedWithoutServerAccepted');
  });
});
