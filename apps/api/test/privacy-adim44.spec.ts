import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import fs from 'node:fs';
import path from 'node:path';

import { PrismaService } from '../src/prisma/prisma.service';
import { redactAuditDetails } from '../src/privacy/audit-redaction.util';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv, operatorBearerToken } from './helpers/operator-auth';
import { createTestOrganization, ensureDefaultOrganization } from './helpers/test-organization';

describe('ADIM 44 privacy (API)', () => {
  let app: INestApplication;
  const orgId = '00000000-0000-4000-8000-000000000441';
  const teamId = '00000000-0000-4000-8000-000000000442';
  const incidentId = '00000000-0000-4000-8000-000000000443';
  const coordinatorId = '00000000-0000-4000-8000-000000000444';
  const operatorId = '00000000-0000-4000-8000-000000000445';
  const password = 'test-password-16chars';
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await ensureDefaultOrganization(prisma);
    await createTestOrganization(prisma, { id: orgId, name: 'privacy-org', slug: 'privacy-org-44' });
    await prisma.team.create({
      data: { id: teamId, name: 'privacy-team', organizationId: orgId },
    });
    await prisma.user.create({
      data: {
        id: coordinatorId,
        email: 'privacy44-coord@sosmesh.example',
        displayName: 'Privacy Coordinator',
        role: UserRole.COORDINATOR,
        teamId,
        passwordHash: hash,
      },
    });
    await prisma.user.create({
      data: {
        id: operatorId,
        email: 'privacy44-operator@sosmesh.example',
        displayName: 'Privacy Operator',
        role: UserRole.OPERATOR,
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
    await prisma.sosMessage.create({
      data: {
        messageId: '00000000-0000-4000-8000-000000000446',
        incidentId,
        operatorDisplayText: 'Sentetik demo metin',
        latitude: 39.925,
        longitude: 32.836,
        locationStatus: 'GPS',
        encryptedNoteBlob: 'opaque-demo-ciphertext',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function coordinatorCookie(): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', allowedOrigin)
      .send({ email: 'privacy44-coord@sosmesh.example', password });
    expect(login.status).toBe(200);
    return login.headers['set-cookie'];
  }

  it('forbids operator from privacy export', async () => {
    const token = operatorBearerToken({ sub: operatorId, role: UserRole.OPERATOR, teamId });
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/privacy/incidents/${incidentId}/export`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('allows coordinator export without raw coordinates or SOS text in audit trail', async () => {
    const token = operatorBearerToken({
      sub: coordinatorId,
      role: UserRole.COORDINATOR,
      teamId,
      organizationId: orgId,
    });
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/privacy/incidents/${incidentId}/export`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('39.925');
    expect(serialized).not.toContain('32.836');
    expect(serialized).not.toContain('Sentetik demo metin');
    expect(response.body.messages[0].hasEncryptedPayload).toBe(true);
  });

  it('forbids operator from erase', async () => {
    const token = operatorBearerToken({ sub: operatorId, role: UserRole.OPERATOR, teamId });
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/privacy/incidents/${incidentId}/erase`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it('returns NOT_FOUND when coordinator JWT lacks organizationId (fail-closed tenant scope)', async () => {
    const token = operatorBearerToken({
      sub: coordinatorId,
      role: UserRole.COORDINATOR,
      teamId,
    });
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/privacy/incidents/${incidentId}/export`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND when coordinator from another organization exports incident (IDOR)', async () => {
    const prisma = app.get(PrismaService);
    const otherOrgId = '00000000-0000-4000-8000-00000000044c';
    const otherTeamId = '00000000-0000-4000-8000-00000000044d';
    const otherCoordinatorId = '00000000-0000-4000-8000-00000000044e';
    const hash = await bcrypt.hash(password, 10);
    await createTestOrganization(prisma, {
      id: otherOrgId,
      name: 'privacy-other-org',
      slug: 'privacy-other-org-44',
    });
    await prisma.team.create({
      data: { id: otherTeamId, name: 'privacy-other-team', organizationId: otherOrgId },
    });
    await prisma.user.create({
      data: {
        id: otherCoordinatorId,
        email: 'privacy44-other-coord@sosmesh.example',
        displayName: 'Other Org Coordinator',
        role: UserRole.COORDINATOR,
        teamId: otherTeamId,
        passwordHash: hash,
      },
    });
    const token = operatorBearerToken({
      sub: otherCoordinatorId,
      role: UserRole.COORDINATOR,
      teamId: otherTeamId,
      organizationId: otherOrgId,
    });
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/privacy/incidents/${incidentId}/export`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND when coordinator from another organization erases incident (IDOR)', async () => {
    const token = operatorBearerToken({
      sub: '00000000-0000-4000-8000-00000000044e',
      role: UserRole.COORDINATOR,
      teamId: '00000000-0000-4000-8000-00000000044d',
      organizationId: '00000000-0000-4000-8000-00000000044c',
    });
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/privacy/incidents/${incidentId}/erase`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('redacts sensitive audit_logs rows in export bundle (integration redaction)', async () => {
    const prisma = app.get(PrismaService);
    await prisma.auditLog.create({
      data: {
        incidentId,
        action: 'CASE_SEEN',
        detailsJson: {
          latitude: 41.123456,
          operatorDisplayText: 'Gizli SOS metni exportta olmamali',
        },
      },
    });
    const token = operatorBearerToken({
      sub: coordinatorId,
      role: UserRole.COORDINATOR,
      teamId,
      organizationId: orgId,
    });
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/privacy/incidents/${incidentId}/export`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('41.123456');
    expect(serialized).not.toContain('Gizli SOS');
    expect(serialized).toContain('[REDACTED]');
  });

  it('blocks cookie-authenticated erase when Origin is not allowlisted (CSRF)', async () => {
    const cookie = await coordinatorCookie();
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/privacy/incidents/${incidentId}/erase`)
      .set('Cookie', cookie)
      .set('Origin', 'http://attacker.example');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CSRF_FORBIDDEN');
  });

  it('forbids coordinator from retention run endpoint', async () => {
    const token = operatorBearerToken({
      sub: coordinatorId,
      role: UserRole.COORDINATOR,
      teamId,
      organizationId: orgId,
    });
    const response = await request(app.getHttpServer())
      .post('/v1/operator/privacy/retention/run')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('erases incident for coordinator and writes redacted audit', async () => {
    const prisma = app.get(PrismaService);
    const sosRow = await prisma.sosMessage.findFirstOrThrow({ where: { incidentId } });
    await prisma.messageEvent.create({
      data: {
        sosMessageId: sosRow.id,
        deliveryState: 'LOCAL_SAVED',
        source: 'privacy-adim44-test',
      },
    });
    await prisma.relayReceipt.create({
      data: {
        sosMessageId: sosRow.id,
        relayId: 'privacy44-relay',
      },
    });
    await prisma.aiAnalysis.create({
      data: {
        incidentId,
        modelVersion: 'privacy44-test',
        resultJson: { suggestion: 'synthetic-only' },
      },
    });

    const cookie = await coordinatorCookie();
    const erase = await request(app.getHttpServer())
      .post(`/v1/operator/privacy/incidents/${incidentId}/erase`)
      .set('Cookie', cookie)
      .set('Origin', allowedOrigin);
    expect(erase.status).toBe(201);
    const remaining = await prisma.incident.findUnique({ where: { id: incidentId } });
    expect(remaining).toBeNull();
    expect(await prisma.sosMessage.count({ where: { incidentId } })).toBe(0);
    expect(await prisma.messageEvent.count({ where: { sosMessageId: sosRow.id } })).toBe(0);
    expect(await prisma.relayReceipt.count({ where: { sosMessageId: sosRow.id } })).toBe(0);
    expect(await prisma.aiAnalysis.count({ where: { incidentId } })).toBe(0);
    const audits = await prisma.auditLog.findMany({
      where: { action: 'PRIVACY_ERASE_REQUEST' },
    });
    expect(audits.length).toBeGreaterThan(0);
    const auditJson = JSON.stringify(audits[0].detailsJson);
    expect(auditJson).not.toContain('Sentetik');
    expect(auditJson).not.toContain('39.925');
  });

  it('redactAuditDetails masks coordinates and SOS fields', () => {
    const redacted = redactAuditDetails({
      before: { latitude: 39.931234, operatorDisplayText: 'Yardim lazim' },
      note: 'secret',
    }) as Record<string, { latitude: string }>;
    expect(redacted.before.latitude).toBe('[REDACTED]');
    expect(JSON.stringify(redacted)).not.toContain('Yardim');
  });
});

describe('ADIM 44 retention job', () => {
  let app: INestApplication;
  const orgId = '00000000-0000-4000-8000-000000000447';
  const teamId = '00000000-0000-4000-8000-000000000448';
  const adminId = '00000000-0000-4000-8000-000000000449';
  const incidentId = '00000000-0000-4000-8000-00000000044a';
  const messageId = '00000000-0000-4000-8000-00000000044b';
  const password = 'test-password-16chars';
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    process.env.RETENTION_JOB_ENABLED = 'true';
    process.env.RETENTION_SOS_MESSAGE_MAX_AGE_SECONDS = '60';
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await ensureDefaultOrganization(prisma);
    await createTestOrganization(prisma, { id: orgId, name: 'retention-org', slug: 'retention-org-44' });
    await prisma.team.create({
      data: { id: teamId, name: 'retention-team', organizationId: orgId },
    });
    await prisma.user.create({
      data: {
        id: adminId,
        email: 'privacy44-admin@sosmesh.example',
        displayName: 'Privacy Admin',
        role: UserRole.ADMIN,
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
    const staleReceivedAt = new Date(Date.now() - 120_000);
    await prisma.sosMessage.create({
      data: {
        messageId,
        incidentId,
        receivedAt: staleReceivedAt,
        locationStatus: 'UNKNOWN',
      },
    });
    await prisma.operatorFeedEvent.create({
      data: {
        messageId,
        incidentId,
        priority: 2,
        locationStatus: 'UNKNOWN',
        occurredAt: staleReceivedAt,
      },
    });
  });

  afterAll(async () => {
    delete process.env.RETENTION_JOB_ENABLED;
    delete process.env.RETENTION_SOS_MESSAGE_MAX_AGE_SECONDS;
    await app.close();
  });

  it('deletes expired incident when retention job runs', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', allowedOrigin)
      .send({ email: 'privacy44-admin@sosmesh.example', password });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'];
    const run = await request(app.getHttpServer())
      .post('/v1/operator/privacy/retention/run')
      .set('Cookie', cookie)
      .set('Origin', allowedOrigin);
    expect(run.status).toBe(201);
    expect(run.body.deletedIncidents).toBe(1);
    const prisma = app.get(PrismaService);
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    expect(incident).toBeNull();
    const feed = await prisma.operatorFeedEvent.findUnique({ where: { messageId } });
    expect(feed).toBeNull();
  });

  it('blocks cookie-authenticated retention run with disallowed Origin (CSRF)', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', allowedOrigin)
      .send({ email: 'privacy44-admin@sosmesh.example', password });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'];
    const blocked = await request(app.getHttpServer())
      .post('/v1/operator/privacy/retention/run')
      .set('Cookie', cookie)
      .set('Origin', 'http://attacker.example');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('CSRF_FORBIDDEN');
  });
});

describe('ADIM 44 demo seed synthetic guard', () => {
  it('seed script uses synthetic domains and opaque ciphertext only', () => {
    const seedPath = path.join(__dirname, '../prisma/seed.ts');
    const source = fs.readFileSync(seedPath, 'utf8');
    expect(source).toContain('sosmesh.example');
    expect(source).toContain('opaque-ciphertext-demo-no-pii');
    expect(source).toContain('SYNTH-Z1');
    expect(source).not.toMatch(/@gmail\.com/i);
    expect(source).not.toMatch(/90555\d{7}/);
  });
});
