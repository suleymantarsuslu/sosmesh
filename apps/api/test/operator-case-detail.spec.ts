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
  const operatorA = '00000000-0000-4000-8000-000000000901';
  const password = 'test-password-16chars';
  const syntheticText = 'Sentetik SOS metni: yardım gerekli (fixture).';

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
        messageId: 'detail-msg-scoped-001',
        incidentId: incidentScoped,
        locationStatus: 'GPS',
        latitude: 39.9,
        longitude: 32.8,
        accuracyMeters: 25,
        priority: 1,
        sosType: 'MEDICAL',
        deliveryState: 'SERVER_ACCEPTED',
        personCount: 2,
        operatorDisplayText: syntheticText,
      },
    });
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
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'detail-operator-a@sosmesh.example', password })
      .then((login) => {
        expect(login.status).toBe(200);
        return login.body.token as string;
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

  it('creates idempotent OPERATOR_SEEN on detail view', async () => {
    const token = await loginToken();
    const prisma = app.get(PrismaService);
    const first = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.originalText).toBe(syntheticText);
    expect(first.body.ai.label).toBe('öneri/taslak, doğrulanmadı');

    const seenCountAfterFirst = await prisma.messageEvent.count({
      where: { deliveryState: 'OPERATOR_SEEN', source: 'operator_view' },
    });
    expect(seenCountAfterFirst).toBe(1);

    const second = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentScoped}/detail`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);

    const seenCountAfterSecond = await prisma.messageEvent.count({
      where: { deliveryState: 'OPERATOR_SEEN', source: 'operator_view' },
    });
    expect(seenCountAfterSecond).toBe(1);
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
