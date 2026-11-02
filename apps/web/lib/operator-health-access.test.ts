import { describe, expect, it } from 'vitest';

import { canAccessOperatorAuditPage, canAccessOperatorHealthPage } from './operator-health-access';

describe('operator health RBAC (ADIM 48)', () => {
  it('denies OPERATOR from health and audit pages', () => {
    expect(canAccessOperatorHealthPage('OPERATOR')).toBe(false);
    expect(canAccessOperatorAuditPage('OPERATOR')).toBe(false);
  });

  it('allows COORDINATOR health but not global audit', () => {
    expect(canAccessOperatorHealthPage('COORDINATOR')).toBe(true);
    expect(canAccessOperatorAuditPage('COORDINATOR')).toBe(false);
  });

  it('allows ADMIN on both pages', () => {
    expect(canAccessOperatorHealthPage('ADMIN')).toBe(true);
    expect(canAccessOperatorAuditPage('ADMIN')).toBe(true);
  });
});
