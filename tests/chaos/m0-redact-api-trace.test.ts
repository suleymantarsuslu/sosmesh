import { execSync } from 'child_process';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

describe('m0_api_trace_redaction', () => {
  const repoRoot = join(__dirname, '..', '..');

  it('jq masks audit coordinates and sensitive text fields', () => {
    const fixture = {
      correlationId: '00000000-0000-4000-8000-000000000099',
      audit: [
        {
          action: 'METADATA_CORRECTION',
          before: { latitude: 39.931234, longitude: 32.861111, note: 'bina yikildi 3 kisi' },
          after: { latitude: 40.1, operatorDisplayText: 'Yardim lazim evim cok kötü' },
        },
      ],
    };
    const output = execSync(
      `jq -f scripts/m0/redact-api-trace.jq`,
      {
        cwd: repoRoot,
        input: JSON.stringify(fixture),
        encoding: 'utf-8',
      }
    );
    const parsed = JSON.parse(output) as {
      audit: { before: Record<string, unknown>; after: Record<string, unknown> }[];
    };
    expect(JSON.stringify(output)).not.toContain('Yardim lazim');
    expect(JSON.stringify(output)).not.toContain('bina yikildi');
    expect(parsed.audit[0].before.latitude).toBe('[REDACTED_COORD]');
    expect(parsed.audit[0].after.operatorDisplayText).toBe('[REDACTED_TEXT]');
  });
});
