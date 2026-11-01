import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv, operatorBearerToken } from './helpers/operator-auth';
import { createTestOrganization, ensureDefaultOrganization } from './helpers/test-organization';

describe('ADIM 43 security gates (API)', () => {
  let app: INestApplication;
  const orgId = '00000000-0000-4000-8000-000000000431';
  const teamId = '00000000-0000-4000-8000-000000000432';
  const incidentId = '00000000-0000-4000-8000-000000000433';
  const operatorId = '00000000-0000-4000-8000-000000000434';
  const password = 'test-password-16chars';
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await ensureDefaultOrganization(prisma);
    await createTestOrganization(prisma, { id: orgId, name: 'sec-org', slug: 'sec-org-43' });
    await prisma.team.create({
      data: { id: teamId, name: 'sec-team', organizationId: orgId },
    });
    await prisma.user.create({
      data: {
        id: operatorId,
        email: 'sec43-operator@sosmesh.example',
        displayName: 'Sec43 Operator',
        role: 'OPERATOR',
        teamId,
        passwordHash: hash,
      },
    });
    await prisma.incident.create({
      data: { id: incidentId, state: 'PENDING' },
    });
    await prisma.assignment.create({
      data: { incidentId, teamId, status: 'OPEN' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 403 for operator POST without allowed Origin (CSRF guard)', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', allowedOrigin)
      .send({ email: 'sec43-operator@sosmesh.example', password });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'];
    const blocked = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentId}/seen`)
      .set('Cookie', cookie)
      .set('Origin', 'http://attacker.example');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('CSRF_FORBIDDEN');
  });

  it('returns 403 when OPERATOR calls admin-only route', async () => {
    const token = operatorBearerToken({ sub: operatorId, role: UserRole.OPERATOR, teamId });
    const response = await request(app.getHttpServer())
      .get('/v1/operator/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('sets baseline security headers on health responses', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

describe('ADIM 43 auth rate limit', () => {
  let app: INestApplication;

  beforeAll(async () => {
    applyTestAuthEnv();
    process.env.AUTH_RATE_LIMIT_MAX = '5';
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash('test-password-16chars', 10);
    await ensureDefaultOrganization(prisma);
    await prisma.user.create({
      data: {
        id: '00000000-0000-4000-8000-000000000435',
        email: 'sec43-ratelimit@sosmesh.example',
        displayName: 'Rate Limit User',
        role: 'OPERATOR',
        passwordHash: hash,
      },
    });
  });

  afterAll(async () => {
    delete process.env.AUTH_RATE_LIMIT_MAX;
    delete process.env.AUTH_RATE_LIMIT_WINDOW_MS;
    await app.close();
  });

  it('returns 429 when auth login rate limit is exceeded', async () => {
    for (let i = 0; i < 5; i += 1) {
      const attempt = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'sec43-ratelimit@sosmesh.example', password: 'wrong-password-xyz' });
      expect(attempt.status).toBe(401);
    }
    const limited = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'sec43-ratelimit@sosmesh.example', password: 'wrong-password-xyz' });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
