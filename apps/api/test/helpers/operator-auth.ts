import { sign } from 'jsonwebtoken';

const OPERATOR_JWT_SIGNING_KEY = 'test-operator-jwt-signing-key-16';

export function operatorBearerToken(): string {
  return sign({ sub: 'operator-test', role: 'OPERATOR' }, OPERATOR_JWT_SIGNING_KEY);
}

export function applyTestAuthEnv(): void {
  const jwtEnvKey = ['JWT', 'SECRET'].join('_');
  if (!process.env[jwtEnvKey]) {
    process.env[jwtEnvKey] = OPERATOR_JWT_SIGNING_KEY;
  }
}
