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

  describe('aggregation by incident', () => {
    const incidentManyMessages = '00000000-0000-4000-8000-000000000510';
    const incidentWithLocation = '00000000-0000-4000-8000-000000000511';

    beforeAll(async () => {
      const prisma = app.get(PrismaService);
      await prisma.incident.createMany({
        data: [
          { id: incidentManyMessages, state: 'PENDING', latestLatitude: 40.0, latestLongitude: 33.0, latestAccuracyMeters: 100 },
          { id: incidentWithLocation, state: 'PENDING' },
        ],
        skipDuplicates: true,
      });
      await prisma.assignment.createMany({
        data: [
          { incidentId: incidentManyMessages, teamId: teamA, status: 'OPEN' },
          { incidentId: incidentWithLocation, teamId: teamA, status: 'OPEN' },
        ],
        skipDuplicates: true,
      });

      for (let i = 0; i < 120; i++) {
        await prisma.sosMessage.create({
          data: {
            messageId: `flood-msg-${i}`,
            incidentId: incidentManyMessages,
            locationStatus: 'UNKNOWN',
            latitude: null,
            longitude: null,
            priority: 2,
            sosType: 'GENERAL',
            deliveryState: 'SERVER_ACCEPTED',
          },
        });
      }

      await prisma.sosMessage.create({
        data: {
          messageId: 'located-msg',
          incidentId: incidentWithLocation,
          locationStatus: 'GPS',
          latitude: 39.5,
          longitude: 32.5,
          accuracyMeters: 15,
          priority: 1,
          sosType: 'FIRE',
          deliveryState: 'SERVER_ACCEPTED',
        },
      });
    });

    it('returns one row per incident, not one per message', async () => {
      const token = await loginToken();
      const response = await request(app.getHttpServer())
        .get('/v1/operator/cases?limit=100')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);

      const incidentIds = (response.body.items as { incidentId: string }[]).map(
        (row) => row.incidentId
      );
      const uniqueIncidentIds = [...new Set(incidentIds)];
      expect(incidentIds.length).toBe(uniqueIncidentIds.length);
    });

    it('includes incident with GPS even when another has 120 locationless messages', async () => {
      const token = await loginToken();
      const response = await request(app.getHttpServer())
        .get('/v1/operator/cases?limit=100')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);

      const incidentIds = (response.body.items as { incidentId: string }[]).map(
        (row) => row.incidentId
      );
      expect(incidentIds).toContain(incidentWithLocation);
    });

    it('uses most recent message with location for coordinates', async () => {
      const token = await loginToken();
      const prisma = app.get(PrismaService);

      const testIncident = '00000000-0000-4000-8000-000000000512';
      await prisma.incident.create({
        data: { id: testIncident, state: 'PENDING' },
      });
      await prisma.assignment.create({
        data: { incidentId: testIncident, teamId: teamA, status: 'OPEN' },
      });

      await prisma.sosMessage.create({
        data: {
          messageId: 'location-msg-1',
          incidentId: testIncident,
          locationStatus: 'GPS',
          latitude: 40.1,
          longitude: 33.1,
          accuracyMeters: 20,
          priority: 2,
          sosType: 'GENERAL',
          deliveryState: 'SERVER_ACCEPTED',
          receivedAt: new Date('2024-01-01T10:00:00Z'),
        },
      });

      await prisma.sosMessage.create({
        data: {
          messageId: 'location-msg-2',
          incidentId: testIncident,
          locationStatus: 'GPS',
          latitude: 40.2,
          longitude: 33.2,
          accuracyMeters: 10,
          priority: 1,
          sosType: 'GENERAL',
          deliveryState: 'SERVER_ACCEPTED',
          receivedAt: new Date('2024-01-01T11:00:00Z'),
        },
      });

      await prisma.sosMessage.create({
        data: {
          messageId: 'no-location-msg',
          incidentId: testIncident,
          locationStatus: 'UNKNOWN',
          latitude: null,
          longitude: null,
          priority: 1,
          sosType: 'GENERAL',
          deliveryState: 'SERVER_ACCEPTED',
          receivedAt: new Date('2024-01-01T12:00:00Z'),
        },
      });

      const response = await request(app.getHttpServer())
        .get('/v1/operator/cases')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);

      const row = (response.body.items as { incidentId: string; latitude: number; longitude: number }[]).find(
        (r) => r.incidentId === testIncident
      );
      expect(row).toBeDefined();
      expect(row!.latitude).toBeCloseTo(40.2, 1);
      expect(row!.longitude).toBeCloseTo(33.2, 1);
    });
  });
});
