export const SESSION_COOKIE = 'sosmesh_session';

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export function isE2eMock(): boolean {
  return process.env.OPERATOR_E2E_MOCK === '1';
}
