import { sign } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const OPERATOR_JWT_SIGNING_KEY = 'test-operator-jwt-signing-key-16';

export type OperatorTokenOptions = {
  sub?: string;
  role?: UserRole | 'OPERATOR' | 'ADMIN' | 'COORDINATOR';
  teamId?: string;
  organizationId?: string;
};

export function operatorBearerToken(options: OperatorTokenOptions = {}): string {
  const payload = {
    sub: options.sub ?? '00000000-0000-4000-8000-000000000099',
    role: options.role ?? UserRole.ADMIN,
    ...(options.teamId ? { teamId: options.teamId } : {}),
    ...(options.organizationId ? { organizationId: options.organizationId } : {}),
  };
  return sign(payload, OPERATOR_JWT_SIGNING_KEY, { algorithm: 'HS256' });
}

export function applyTestAuthEnv(): void {
  const jwtEnvKey = ['JWT', 'SECRET'].join('_');
  if (!process.env[jwtEnvKey]) {
    process.env[jwtEnvKey] = OPERATOR_JWT_SIGNING_KEY;
  }
  if (!process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS = 'http://localhost:3000';
  }
}
