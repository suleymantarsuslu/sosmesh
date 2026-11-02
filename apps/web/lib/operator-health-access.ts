export type OperatorHealthRole = 'OPERATOR' | 'ADMIN' | 'COORDINATOR';

export function canAccessOperatorHealthPage(role: string): boolean {
  return role === 'ADMIN' || role === 'COORDINATOR';
}

export function canAccessOperatorAuditPage(role: string): boolean {
  return role === 'ADMIN';
}
