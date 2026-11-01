import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv } from './helpers/operator-auth';

describe('Operator case detail and actions (ADIM 23)', () => {
  let app: INestApplication;
  const teamA = '00000000-0000-4000-8000-000000000701';
  const teamB = '00000000-0000-4000-8000-000000000702';
  const incidentScoped = '00000000-0000-4000-8000-000000000801';
  const incidentOther = '00000000-0000-4000-8000-000000000802';
  const incidentConcurrent = '00000000-0000-4000-8000-000000000803';
  const incidentVersionRace = '00000000-0000-4000-8000-000000000804';
  const operatorA = '00000000-0000-4000-8000-000000000901';
  const password = 'test-password-16chars';
  const syntheticText = 'Sentetik SOS metni: yardım gerekli (fixture).';
  const allowedOrigin = 'http://localhost:3000';
  let cachedToken: string | null = null;

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await prisma.team.createMany({
      data: [
        { id: teamA, name: 'detail-team-a' },
        { id: teamB, name: 'detail-team-b' },
      ],
      skipDuplicates: true,
    });
    await prisma.user.create({
      data: {
        id: operatorA,
        email: 'detail-operator-a@sosmesh.example',
        displayName: 'Detail Operator A',
        role: 'OPERATOR',
        teamId: teamA,
        passwordHash: hash,
      },
    });
    await prisma.incident.createMany({
      data: [
        { id: incidentScoped, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
        { id: incidentOther, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
        { id: incidentConcurrent, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
        { id: incidentVersionRace, state: 'PENDING', version: 0, reviewStatus: 'SEEN' },
      ],
      skipDuplicates: true,
    });
    await prisma.assignment.createMany({
      data: [
        { incidentId: incidentScoped, teamId: teamA, status: 'OPEN' },
        { incidentId: incidentOther, teamId: teamB, status: 'OPEN' },
        { incidentId: incidentConcurrent, teamId: teamA, status: 'OPEN' },
        { incidentId: incidentVersionRace, teamId: teamA, status: 'OPEN' },
      ],
    });
    const messages = [
      {
        messageId: 'detail-msg-scoped-001',
        incidentId: incidentScoped,
        locationStatus: 'GPS' as const,
        latitude: 39.9,
        longitude: 32.8,
        accuracyMeters: 25,
        priority: 1,
        sosType: 'MEDICAL' as const,
        deliveryState: 'SERVER_ACCEPTED' as const,
        personCount: 2,
        operatorDisplayText: syntheticText,
      },
      {
        messageId: 'detail-msg-concurrent-001',
        incidentId: incidentConcurrent,
        locationStatus: 'GPS' as const,
        latitude: 40.1,
        longitude: 33.1,
        deliveryState: 'SERVER_ACCEPTED' as const,
      },
      {
        messageId: 'detail-msg-version-race-001',
        incidentId: incidentVersionRace,
        locationStatus: 'GPS' as const,
        latitude: 41.0,
        longitude: 34.0,
        deliveryState: 'SERVER_ACCEPTED' as const,
      },
    ];
    for (const row of messages) {
      await prisma.sosMessage.create({ data: row });
    }
    await prisma.aiAnalysis.create({
      data: {
        incidentId: incidentScoped,
        modelVersion: 'mock-meta',
        status: 'COMPLETED',
        resultJson: {
          categories: ['medical'],
          persons_estimate: 2,
          injuries_reported: [],
          needs: ['değerlendirme'],
          urgency_suggestion: 'high',
          uncertainty: true,
          quoted_evidence: ['yardım'],
          location_unknown: false,
          language: 'tr',
          requires_human_review: true,
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function loginToken(): Promise<string> {
    if (cachedToken) {
      return Promise.resolve(cachedToken);
    }
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'detail-operator-a@sosmesh.example', password })
      .then((login) => {
        expect(login.status).toBe(200);
        cachedToken = login.body.token as string;
        return cachedToken;
      });
  }

  it('returns 401 without auth on detail', async () => {
    const response = await request(app.getHttpServer()).get(
      `/v1/operator/cases/${incidentScoped}/detail`
    );
    expect(response.status).toBe(401);
  });

  it('returns 404 for out-of-scope detail', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentOther}/detail`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  it('GET detail alone does not create OPERATOR_SEEN', async () => {
    const token = await loginToken();
    const prisma = app.get(PrismaService);
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.originalText).toBe(syntheticText);
    const seenCount = await prisma.messageEvent.count({
      where: { deliveryState: 'OPERATOR_SEEN', source: 'operator_view' },
    });
    expect(seenCount).toBe(0);
  });

  it('POST seen creates idempotent OPERATOR_SEEN and audit', async () => {
    const token = await loginToken();
    const prisma = app.get(PrismaService);
    const first = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/seen`)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(true);

    const seenCountAfterFirst = await prisma.messageEvent.count({
      where: { deliveryState: 'OPERATOR_SEEN', source: 'operator_view' },
    });
    expect(seenCountAfterFirst).toBe(1);
    const auditCount = await prisma.auditLog.count({
      where: { incidentId: incidentScoped, action: 'OPERATOR_SEEN' },
    });
    expect(auditCount).toBe(1);

    const second = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/seen`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(201);
    expect(second.body.created).toBe(false);

    const seenCountAfterSecond = await prisma.messageEvent.count({
      where: { deliveryState: 'OPERATOR_SEEN', source: 'operator_view' },
    });
    expect(seenCountAfterSecond).toBe(1);
    const auditAfterSecond = await prisma.auditLog.count({
      where: { incidentId: incidentScoped, action: 'OPERATOR_SEEN' },
    });
    expect(auditAfterSecond).toBe(1);
  });

  it('returns 403 for cookie POST seen with disallowed Origin', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/v1/auth/login')
      .set('Origin', allowedOrigin)
      .send({ email: 'detail-operator-a@sosmesh.example', password });
    const response = await agent
      .post(`/v1/operator/cases/${incidentConcurrent}/seen`)
      .set('Origin', 'http://evil.example');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CSRF_FORBIDDEN');
  });

  it('serializes concurrent POST seen to one event and one audit', async () => {
    const token = await loginToken();
    const prisma = app.get(PrismaService);
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post(`/v1/operator/cases/${incidentConcurrent}/seen`)
          .set('Authorization', `Bearer ${token}`)
      )
    );
    expect(responses.every((row) => row.status === 201)).toBe(true);
    const seenCount = await prisma.messageEvent.count({
      where: {
        deliveryState: 'OPERATOR_SEEN',
        source: 'operator_view',
        sosMessage: { incidentId: incidentConcurrent },
      },
    });
    expect(seenCount).toBe(1);
    const auditCount = await prisma.auditLog.count({
      where: { incidentId: incidentConcurrent, action: 'OPERATOR_SEEN' },
    });
    expect(auditCount).toBe(1);
  });

  it('returns 409 on review status version mismatch', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const version = detail.body.version as number;
    const conflict = await request(app.getHttpServer())
      .patch(`/v1/operator/cases/${incidentScoped}/review-status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: version - 1, reviewStatus: 'UNDER_REVIEW' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('VERSION_CONFLICT');
  });

  it('parallel review-status PATCH with same version yields one success and one 409', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentVersionRace}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const version = detail.body.version as number;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/v1/operator/cases/${incidentVersionRace}/review-status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ expectedVersion: version, reviewStatus: 'UNDER_REVIEW' }),
      request(app.getHttpServer())
        .patch(`/v1/operator/cases/${incidentVersionRace}/review-status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ expectedVersion: version, reviewStatus: 'COORDINATING' }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(first.status === 500 || second.status === 500).toBe(false);
  });

  it('records metadata correction audit with before/after', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const version = detail.body.version as number;
    const correction = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: version, personCount: 3 });
    expect(correction.status).toBe(201);
    expect(correction.body.before.personCount).toBe(2);
    expect(correction.body.after.personCount).toBe(3);

    const audit = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/audit`)
      .set('Authorization', `Bearer ${token}`);
    expect(audit.status).toBe(200);
    const actions = (audit.body.items as { action: string }[]).map((row) => row.action);
    expect(actions).toContain('METADATA_CORRECTION');
  });

  it('rejects UNKNOWN location with coordinates', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const version = detail.body.version as number;
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: version,
        locationStatus: 'UNKNOWN',
        latitude: 39.9,
      });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('LOCATION_INCONSISTENT');
  });

  it('requires coordinates for GPS location status', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const version = detail.body.version as number;
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: version,
        locationStatus: 'GPS',
        latitude: null,
        longitude: null,
      });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('LOCATION_COORDINATES_REQUIRED');
  });

  it('rejects invalid review transition', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const bad = await request(app.getHttpServer())
      .patch(`/v1/operator/cases/${incidentScoped}/review-status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: detail.body.version, reviewStatus: 'NEW' });
    expect(bad.status).toBe(400);
  });
});
