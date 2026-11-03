import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv } from './helpers/operator-auth';
import { createTestOrganization, ensureDefaultOrganization } from './helpers/test-organization';

describe('Operator case detail and actions (ADIM 23)', () => {
  let app: INestApplication;
  const orgA = '00000000-0000-4000-8000-000000000311';
  const teamA = '00000000-0000-4000-8000-000000000701';
  const teamB = '00000000-0000-4000-8000-000000000702';
  const incidentScoped = '00000000-0000-4000-8000-000000000801';
  const incidentOther = '00000000-0000-4000-8000-000000000802';
  const incidentConcurrent = '00000000-0000-4000-8000-000000000803';
  const incidentVersionRace = '00000000-0000-4000-8000-000000000804';
  const incidentCorrectionRace = '00000000-0000-4000-8000-000000000805';
  const incidentAiOverride = '00000000-0000-4000-8000-000000000806';
  const incidentAiOverrideRace = '00000000-0000-4000-8000-000000000807';
  const incidentAiFailed = '00000000-0000-4000-8000-000000000808';
  const operatorA = '00000000-0000-4000-8000-000000000901';
  const password = 'test-password-16chars';
  const syntheticText = 'Sentetik SOS metni: yardım gerekli (fixture).';
  const allowedOrigin = 'http://localhost:3000';
  let cachedToken: string | null = null;

  const validAiOverride = {
    categories: ['medical'],
    persons_estimate: 1,
    injuries_reported: [],
    needs: ['değerlendirme'],
    urgency_suggestion: 'medium',
    uncertainty: false,
    quoted_evidence: ['sentetik'],
    location_unknown: false,
    language: 'tr',
    requires_human_review: true,
  };

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await ensureDefaultOrganization(prisma);
    await createTestOrganization(prisma, { id: orgA, name: 'detail-org-a', slug: 'detail-org-a' });
    await prisma.team.createMany({
      data: [
        { id: teamA, name: 'detail-team-a', organizationId: orgA },
        { id: teamB, name: 'detail-team-b', organizationId: orgA },
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
        { id: incidentCorrectionRace, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
        { id: incidentAiOverride, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
        { id: incidentAiOverrideRace, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
        { id: incidentAiFailed, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
      ],
      skipDuplicates: true,
    });
    await prisma.assignment.createMany({
      data: [
        { incidentId: incidentScoped, teamId: teamA, status: 'OPEN' },
        { incidentId: incidentOther, teamId: teamB, status: 'OPEN' },
        { incidentId: incidentConcurrent, teamId: teamA, status: 'OPEN' },
        { incidentId: incidentVersionRace, teamId: teamA, status: 'OPEN' },
        { incidentId: incidentCorrectionRace, teamId: teamA, status: 'OPEN' },
        { incidentId: incidentAiOverride, teamId: teamA, status: 'OPEN' },
        { incidentId: incidentAiOverrideRace, teamId: teamA, status: 'OPEN' },
        { incidentId: incidentAiFailed, teamId: teamA, status: 'OPEN' },
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
      {
        messageId: 'detail-msg-correction-race-001',
        incidentId: incidentCorrectionRace,
        locationStatus: 'GPS' as const,
        latitude: 39.5,
        longitude: 32.5,
        deliveryState: 'SERVER_ACCEPTED' as const,
        personCount: 1,
      },
      {
        messageId: 'detail-msg-ai-override-001',
        incidentId: incidentAiOverride,
        locationStatus: 'GPS' as const,
        latitude: 39.6,
        longitude: 32.6,
        deliveryState: 'SERVER_ACCEPTED' as const,
      },
      {
        messageId: 'detail-msg-ai-override-race-001',
        incidentId: incidentAiOverrideRace,
        locationStatus: 'GPS' as const,
        latitude: 39.7,
        longitude: 32.7,
        deliveryState: 'SERVER_ACCEPTED' as const,
      },
      {
        messageId: 'detail-msg-ai-failed-001',
        incidentId: incidentAiFailed,
        locationStatus: 'UNKNOWN' as const,
        latitude: null,
        longitude: null,
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
    await prisma.aiAnalysis.create({
      data: {
        incidentId: incidentAiFailed,
        modelVersion: 'mock-meta',
        status: 'FAILED',
        resultJson: { error: 'provider_unavailable' },
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
      where: {
        deliveryState: 'OPERATOR_SEEN',
        source: 'operator_view',
        sosMessage: { incidentId: incidentScoped },
      },
    });
    expect(seenCount).toBe(0);
  });

  it('returns 404 for POST seen on out-of-scope incident', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentOther}/seen`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
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
      where: {
        deliveryState: 'OPERATOR_SEEN',
        source: 'operator_view',
        sosMessage: { incidentId: incidentScoped },
      },
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
      where: {
        deliveryState: 'OPERATOR_SEEN',
        source: 'operator_view',
        sosMessage: { incidentId: incidentScoped },
      },
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
    expect(first.status).not.toBe(500);
    expect(second.status).not.toBe(500);
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

  it('rejects latitude out of range', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: detail.body.version, latitude: 91, longitude: 10 });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_LATITUDE');
  });

  it('rejects longitude out of range', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: detail.body.version, latitude: 10, longitude: 181 });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_LONGITUDE');
  });

  it('rejects MANUAL location without coordinates', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: detail.body.version,
        locationStatus: 'MANUAL',
        latitude: null,
        longitude: null,
      });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('LOCATION_COORDINATES_REQUIRED');
  });

  it('accepts MANUAL location with valid coordinates', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: detail.body.version,
        locationStatus: 'MANUAL',
        latitude: 39.91,
        longitude: 32.81,
      });
    expect(response.status).toBe(201);
  });

  it('rejects negative personCount in DTO', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentScoped}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: detail.body.version, personCount: -1 });
    expect(response.status).toBe(400);
  });

  it('parallel corrections with same version yield 201 and 409', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentCorrectionRace}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const version = detail.body.version as number;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/operator/cases/${incidentCorrectionRace}/corrections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ expectedVersion: version, personCount: 2 }),
      request(app.getHttpServer())
        .post(`/v1/operator/cases/${incidentCorrectionRace}/corrections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ expectedVersion: version, personCount: 3 }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
  });

  it('accepts valid ai-override', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentAiOverride}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentAiOverride}/ai-override`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: detail.body.version, override: validAiOverride });
    expect(response.status).toBe(201);
  });

  it('rejects invalid ai-override schema', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentAiOverride}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentAiOverride}/ai-override`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: detail.body.version,
        override: { ...validAiOverride, urgency_suggestion: 'not-valid' },
      });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_AI_OVERRIDE');
  });

  it('returns 404 for ai-override on out-of-scope incident', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentOther}/ai-override`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: 0, override: validAiOverride });
    expect(response.status).toBe(404);
  });

  it('parallel ai-override with same version yields 201 and 409', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentAiOverrideRace}/detail`)
      .set('Authorization', `Bearer ${token}`);
    const version = detail.body.version as number;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/operator/cases/${incidentAiOverrideRace}/ai-override`)
        .set('Authorization', `Bearer ${token}`)
        .send({ expectedVersion: version, override: validAiOverride }),
      request(app.getHttpServer())
        .post(`/v1/operator/cases/${incidentAiOverrideRace}/ai-override`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          expectedVersion: version,
          override: { ...validAiOverride, urgency_suggestion: 'high' },
        }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
  });

  it('does not expose AI suggestion payload when analysis FAILED', async () => {
    const token = await loginToken();
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentAiFailed}/detail`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.ai?.status).toBe('FAILED');
    expect(detail.body.ai?.suggestion).toBeNull();
    expect(detail.body.verifiedMetadata.locationStatus).toBe('UNKNOWN');
  });

  it('loads case detail with attachment (storageKey mapping fix)', async () => {
    const token = await loginToken();
    const prisma = app.get(PrismaService);
    
    const incidentWithAttachment = '00000000-0000-4000-8000-000000000901';
    const messageWithAttachment = 'detail-msg-attachment-001';
    
    await prisma.incident.create({
      data: {
        id: incidentWithAttachment,
        state: 'PENDING',
        version: 0,
        reviewStatus: 'NEW',
      },
    });
    
    await prisma.assignment.create({
      data: {
        incidentId: incidentWithAttachment,
        teamId: teamA,
        status: 'OPEN',
      },
    });
    
    const sosMsg = await prisma.sosMessage.create({
      data: {
        messageId: messageWithAttachment,
        incidentId: incidentWithAttachment,
        locationStatus: 'GPS',
        latitude: 40.0,
        longitude: 33.0,
        deliveryState: 'SERVER_ACCEPTED',
        operatorDisplayText: 'Test with attachment',
      },
    });
    
    await prisma.attachment.create({
      data: {
        incidentId: incidentWithAttachment,
        sosMessageId: sosMsg.id,
        kind: 'PHOTO',
        mime: 'image/jpeg',
        sizeBytes: 12345,
        storageKey: 's3://bucket/path/to/photo.jpg',
        sha256: 'a'.repeat(64),
        synthetic: true,
      },
    });
    
    const detail = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentWithAttachment}/detail`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(detail.status).toBe(200);
    expect(detail.body.originalText).toBe('Test with attachment');
  });
});
