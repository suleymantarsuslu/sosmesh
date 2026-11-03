export const SESSION_COOKIE = 'sosmesh_session';

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export function isE2eMock(): boolean {
  if (process.env.OPERATOR_E2E_MOCK !== '1') {
    return false;
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[SOSMesh] OPERATOR_E2E_MOCK is set but ignored in production (mock disabled).'
    );
    return false;
  }
  return true;
}
