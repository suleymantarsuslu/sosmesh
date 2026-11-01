import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv } from './helpers/operator-auth';
import { createTestOrganization, ensureDefaultOrganization } from './helpers/test-organization';

describe('Operator cases map/list API', () => {
  let app: INestApplication;
  const orgA = '00000000-0000-4000-8000-000000000211';
  const teamA = '00000000-0000-4000-8000-000000000401';
  const teamB = '00000000-0000-4000-8000-000000000402';
  const incidentScoped = '00000000-0000-4000-8000-000000000501';
  const incidentOther = '00000000-0000-4000-8000-000000000502';
  const operatorA = '00000000-0000-4000-8000-000000000601';
  const password = 'test-password-16chars';

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await ensureDefaultOrganization(prisma);
    await createTestOrganization(prisma, { id: orgA, name: 'cases-org-a', slug: 'cases-org-a' });
    await prisma.team.createMany({
      data: [
        { id: teamA, name: 'cases-team-a', organizationId: orgA },
        { id: teamB, name: 'cases-team-b', organizationId: orgA },
      ],
      skipDuplicates: true,
    });
    await prisma.user.create({
      data: {
        id: operatorA,
        email: 'cases-operator-a@sosmesh.example',
        displayName: 'Cases Operator A',
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
    await prisma.assignment.createMany({
      data: [
        { incidentId: incidentScoped, teamId: teamA, status: 'OPEN' },
        { incidentId: incidentOther, teamId: teamB, status: 'OPEN' },
      ],
    });
    await prisma.sosMessage.create({
      data: {
        messageId: 'cases-msg-scoped-gps',
        incidentId: incidentScoped,
        locationStatus: 'GPS',
        latitude: 39.9,
        longitude: 32.8,
        accuracyMeters: 25,
        priority: 1,
        sosType: 'MEDICAL',
        deliveryState: 'SERVER_ACCEPTED',
      },
    });
    await prisma.sosMessage.create({
      data: {
        messageId: 'cases-msg-other-hidden',
        incidentId: incidentOther,
        locationStatus: 'GPS',
        latitude: 41.0,
        longitude: 29.0,
        priority: 2,
      },
    });
    await prisma.sosMessage.create({
      data: {
        messageId: 'cases-msg-scoped-unknown',
        incidentId: incidentScoped,
        locationStatus: 'UNKNOWN',
        latitude: null,
        longitude: null,
        priority: 3,
        sosType: 'GENERAL',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function loginToken(): Promise<string> {
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'cases-operator-a@sosmesh.example', password })
      .then((login) => {
        expect(login.status).toBe(200);
        return login.body.token as string;
      });
  }

  it('returns 401 without auth', async () => {
    const response = await request(app.getHttpServer()).get('/v1/operator/cases');
    expect(response.status).toBe(401);
  });

  it('lists only in-scope cases', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/cases')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const incidentIds = (response.body.items as { incidentId: string }[]).map(
      (row) => row.incidentId
    );
    expect(incidentIds).toContain(incidentScoped);
    expect(incidentIds).not.toContain(incidentOther);
  });

  it('filters by category', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/cases?category=MEDICAL')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const items = response.body.items as { sosType: string; incidentId: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((row) => row.sosType === 'MEDICAL')).toBe(true);
    expect(items.every((row) => row.incidentId === incidentScoped)).toBe(true);
  });

  it('returns 404 for out-of-scope case detail', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentOther}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });
});
