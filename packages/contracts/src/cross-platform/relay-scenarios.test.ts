import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

describe('cross_platform_relay_scenarios_fixture', () => {
  it('physical_scenarios_remain_not_tested', () => {
    const path = join(__dirname, '../../../fixtures/cross-platform/relay-scenarios.json');
    const fixture = JSON.parse(readFileSync(path, 'utf-8')) as {
      scenarios: Array<{ id: string; verification: string; environment: string }>;
    };
    const physical = fixture.scenarios.filter((s) => s.environment.includes('physical'));
    expect(physical.length).toBeGreaterThan(0);
    for (const row of physical) {
      expect(row.verification).toBe('NOT_TESTED');
    }
  });
});
