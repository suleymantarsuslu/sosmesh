import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv, operatorBearerToken } from './helpers/operator-auth';
import { createTestOrganization, ensureDefaultOrganization } from './helpers/test-organization';

describe('Auth and operator RBAC', () => {
  let app: INestApplication;
  const orgA = '00000000-0000-4000-8000-000000000111';
  const teamA = '00000000-0000-4000-8000-000000000101';
  const teamB = '00000000-0000-4000-8000-000000000102';
  const incidentScoped = '00000000-0000-4000-8000-000000000201';
  const incidentOther = '00000000-0000-4000-8000-000000000202';
  const operatorA = '00000000-0000-4000-8000-000000000301';
  const password = 'test-password-16chars';
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await ensureDefaultOrganization(prisma);
    await createTestOrganization(prisma, { id: orgA, name: 'org-a', slug: 'org-a-rbac' });
    await prisma.team.createMany({
      data: [
        { id: teamA, name: 'team-a', organizationId: orgA },
        { id: teamB, name: 'team-b', organizationId: orgA },
      ],
      skipDuplicates: true,
    });
    await prisma.user.create({
      data: {
        id: operatorA,
        email: 'operator-a@sosmesh.example',
        displayName: 'Operator A',
        role: 'OPERATOR',
        teamId: teamA,
        passwordHash: hash,
      },
    });
    await prisma.incident.createMany({
      data: [
        { id: incidentScoped, state: 'PENDING' },
        { id: incidentOther, state: 'PENDING' },
      ],
      skipDuplicates: true,
    });
    await prisma.assignment.create({
      data: {
        incidentId: incidentScoped,
        teamId: teamA,
        status: 'OPEN',
      },
    });
    await prisma.assignment.create({
      data: {
        incidentId: incidentOther,
        teamId: teamB,
        status: 'OPEN',
      },
    });
    await prisma.operatorFeedEvent.create({
      data: {
        messageId: 'feed-msg-team-a',
        incidentId: incidentScoped,
        priority: 2,
        locationStatus: 'UNKNOWN',
        occurredAt: new Date(),
      },
    });
    await prisma.operatorFeedEvent.create({
      data: {
        messageId: 'feed-msg-team-b',
        incidentId: incidentOther,
        priority: 2,
        locationStatus: 'UNKNOWN',
        latitude: 41.0,
        longitude: 29.0,
        occurredAt: new Date(),
      },
    });
    await prisma.sosMessage.create({
      data: {
        messageId: '00000000-0000-4000-8000-000000000401',
        incidentId: incidentOther,
        locationStatus: 'UNKNOWN',
        priority: 1,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function loginToken(): Promise<string> {
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'operator-a@sosmesh.example', password })
      .then((login) => {
        expect(login.status).toBe(200);
        return login.body.token as string;
      });
  }

  it('returns 401 for login with wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'operator-a@sosmesh.example', password: 'wrong-password-xyz' });
    expect(response.status).toBe(401);
  });

  it('returns 401 when operator endpoint is called without auth', async () => {
    const response = await request(app.getHttpServer()).get('/v1/operator/incidents');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when operator role calls admin endpoint', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('returns 403 for operator-test JWT with OPERATOR role on admin users', async () => {
    const token = operatorBearerToken({ sub: 'operator-test', role: UserRole.OPERATOR });
    const response = await request(app.getHttpServer())
      .get('/v1/operator/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('lists only team-scoped incidents for operator', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/incidents')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const ids = (response.body.items as { id: string }[]).map((i) => i.id);
    expect(ids).toContain(incidentScoped);
    expect(ids).not.toContain(incidentOther);
  });

  it('returns 404 for out-of-scope incident detail', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/incidents/${incidentOther}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  it('scopes operator feed polling to team assignments', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/events?after=0')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const events = response.body.events as { incidentId: string }[];
    const incidentIds = events.map((event) => event.incidentId);
    expect(incidentIds).toContain(incidentScoped);
    expect(incidentIds).not.toContain(incidentOther);
  });

  it('excludes out-of-scope incidents from dashboard stats', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.hasData).toBe(true);
    expect(response.body.openOnPanel).toBe(1);
    expect(response.body.pending).toBe(1);
  });

  it('allows ADMIN bearer on operator events', async () => {
    const token = operatorBearerToken({ role: UserRole.ADMIN });
    const response = await request(app.getHttpServer())
      .get('/v1/operator/events?after=0')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const events = response.body.events as { incidentId: string }[];
    const incidentIds = events.map((event) => event.incidentId);
    expect(incidentIds).toContain(incidentScoped);
    expect(incidentIds).toContain(incidentOther);
  });

  it('returns 403 for cookie auth POST with disallowed Origin', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', allowedOrigin)
      .send({ email: 'operator-a@sosmesh.example', password });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'];
    expect(cookie).toBeDefined();
    const response = await request(app.getHttpServer())
      .post('/v1/operator/messages')
      .set('Cookie', cookie)
      .set('Origin', 'http://evil.example')
      .send({
        messageId: '00000000-0000-4000-8000-000000000501',
        incidentId: incidentScoped,
        sosType: 'GENERAL',
        locationStatus: 'UNKNOWN',
        priority: 3,
      });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CSRF_FORBIDDEN');
  });
});
