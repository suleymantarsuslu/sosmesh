import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { INestApplication, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import { AiJobService } from '../src/ai/ai-job.service';
import { alertsRecovered, evaluatePrometheusAlerts } from '../src/observability/alert-rules.util';
import { buildStructuredEvent, redactLogString } from '../src/observability/redact-log-fields.util';
import { OperatorObservabilityService } from '../src/observability/operator-observability.service';
import { StructuredEventLogger } from '../src/observability/structured-event-logger.service';
import { SosMeshMetricsService } from '../src/observability/sosmesh-metrics.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import {
  applyTestAuthEnv,
  metricsScrapeAuthHeader,
  operatorBearerToken,
} from './helpers/operator-auth';
import { createTestOrganization, ensureDefaultOrganization } from './helpers/test-organization';

const PII_PATTERNS = [
  /\+90\s?5\d{2}/,
  /latitude/i,
  /longitude/i,
  /encryptedPayload/i,
  /plaintext/i,
  /JWT_SECRET/,
];

function scanMonitoringJsonForPii(root: string): string[] {
  const violations: string[] = [];
  const files = readdirSync(root, { recursive: true }) as string[];
  for (const relative of files) {
    if (!relative.endsWith('.json') && !relative.endsWith('.yml') && !relative.endsWith('.yaml')) {
      continue;
    }
    const full = join(root, relative);
    const text = readFileSync(full, 'utf8');
    for (const pattern of PII_PATTERNS) {
      if (pattern.test(text)) {
        violations.push(`${relative}: matched ${pattern}`);
      }
    }
  }
  return violations;
}

describe('ADIM 48 observability, runbooks, audit', () => {
  let app: INestApplication;
  let metrics: SosMeshMetricsService;
  const orgId = randomUUID();
  const teamId = randomUUID();
  const adminId = randomUUID();
  const operatorId = randomUUID();
  const orgSlug = `obs-org-48-${orgId.slice(0, 8)}`;
  const password = 'test-password-16chars';

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    metrics = app.get(SosMeshMetricsService);
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await ensureDefaultOrganization(prisma);
    await createTestOrganization(prisma, { id: orgId, name: 'obs-org', slug: orgSlug });
    await prisma.team.create({
      data: { id: teamId, name: 'obs-team', organizationId: orgId },
    });
    await prisma.user.createMany({
      data: [
        {
          id: adminId,
          email: 'obs-admin@sosmesh.example',
          displayName: 'Obs Admin',
          role: UserRole.ADMIN,
          teamId,
          passwordHash: hash,
        },
        {
          id: operatorId,
          email: 'obs-operator@sosmesh.example',
          displayName: 'Obs Operator',
          role: UserRole.OPERATOR,
          teamId,
          passwordHash: hash,
        },
      ],
    });
    await prisma.auditLog.create({
      data: {
        action: 'OPERATOR_SEEN',
        actorId: operatorId,
        incidentId: null,
        detailsJson: {
          note: 'secret SOS metni 5551234567',
          latitude: 41.015,
          longitude: 28.979,
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    metrics.resetForTests();
    metrics.setDatabaseUp(true);
  });

  it('redacts SOS text, phone, coordinates, and tokens from structured events', () => {
    const phone = `+90${'5551234567'}`;
    const coordPair = ['41.0123', '28.9654'].join(',');
    const jwtLike = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'e30', 'sig'].join('.');
    const raw = `yardim ${phone} lat ${coordPair} token ${jwtLike}`;
    expect(redactLogString(raw)).not.toContain(phone);
    expect(redactLogString(raw)).not.toContain(coordPair);
    expect(redactLogString(raw)).not.toContain('eyJhbGci');

    const event = buildStructuredEvent('test_event', 'corr-48', {
      plaintext: '5551234567',
      latitude: 39.1,
      note: 'SOS',
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('5551234567');
    expect(serialized).not.toContain('39.1');
    expect(serialized).toContain('corr-48');
  });

  it('redacts sensitive fields in StructuredEventLogger log output', () => {
    const events = app.get(StructuredEventLogger);
    let loggedLine = '';
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation((message) => {
      loggedLine = String(message);
    });
    const jwtLike = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'e30', 'sig'].join('.');
    events.emit('ingest_test_redaction', {
      note: '5551234567 acil',
      latitude: 41.01,
      token: jwtLike,
    });
    logSpy.mockRestore();
    expect(loggedLine).not.toContain('5551234567');
    expect(loggedLine).not.toContain('41.01');
    expect(loggedLine).not.toContain('eyJhbGci');
    expect(loggedLine).toContain('ingest_test_redaction');
  });

  it('rejects unauthenticated /metrics scrape (fail-closed)', async () => {
    const response = await request(app.getHttpServer()).get('/metrics');
    expect(response.status).toBe(401);
    expect(response.body.code).toMatch(/METRICS_SCRAPE/);
  });

  it('exposes Prometheus metrics without PII labels when scrape token is valid', async () => {
    metrics.recordIngestAccepted();
    metrics.recordServerAck();
    const response = await request(app.getHttpServer())
      .get('/metrics')
      .set(metricsScrapeAuthHeader());
    expect(response.status).toBe(200);
    expect(response.text).toContain('sosmesh_ingest_accepted_total');
    expect(response.text).not.toMatch(/latitude|longitude|phone|plaintext/i);
  });

  it('fires and recovers alerts for induced HTTP 500 and DB-down scenarios', async () => {
    metrics.setDatabaseUp(true);
    metrics.recordHttpStatus(500);
    metrics.recordHttpStatus(500);
    metrics.recordHttpStatus(500);

    const snap = metrics.snapshotForAlerts();
    const firing = evaluatePrometheusAlerts({
      ...snap,
      workerStuckSeconds: 0,
    });
    expect(firing.find((a) => a.name === 'SosmeshHighHttpErrorRate')?.firing).toBe(true);

    const observability = app.get(OperatorObservabilityService);
    const summarySpy = jest
      .spyOn(observability, 'getSummary')
      .mockImplementationOnce(() => {
        throw new Error('forced_http_500_for_metrics');
      });
    const adminToken = operatorBearerToken({ sub: adminId, role: UserRole.ADMIN, teamId });
    const errorResponse = await request(app.getHttpServer())
      .get('/v1/operator/observability/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    summarySpy.mockRestore();
    expect(errorResponse.status).toBe(500);
    expect(metrics.getCounter('sosmesh_http_errors_total')).toBeGreaterThanOrEqual(3);

    metrics.resetForTests();
    metrics.setDatabaseUp(false);
    const dbDown = evaluatePrometheusAlerts({
      httpErrors5m: 0,
      databaseUp: metrics.getGauge('sosmesh_health_database_up'),
      aiQueueDepth: 0,
      aiFailures5m: 0,
      ingestRateLimited5m: 0,
      gpsAnomaly5m: 0,
      workerStuckSeconds: 0,
    });
    expect(dbDown.find((a) => a.name === 'SosmeshApiDown')?.firing).toBe(true);

    metrics.setDatabaseUp(true);
    const recovered = evaluatePrometheusAlerts({
      httpErrors5m: 0,
      databaseUp: 1,
      aiQueueDepth: 0,
      aiFailures5m: 0,
      ingestRateLimited5m: 0,
      gpsAnomaly5m: 0,
      workerStuckSeconds: 0,
    });
    expect(alertsRecovered(dbDown, recovered)).toBe(true);
  });

  it('maps /health/ready DB failure to sosmesh_health_database_up gauge', async () => {
    const prisma = app.get(PrismaService);
    const original = prisma.$queryRaw.bind(prisma);
    jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('db_down'));
    const failed = await request(app.getHttpServer()).get('/health/ready');
    expect(failed.status).toBe(503);
    expect(metrics.getGauge('sosmesh_health_database_up')).toBe(0);
    jest.spyOn(prisma, '$queryRaw').mockImplementation(original);
    const ok = await request(app.getHttpServer()).get('/health/ready');
    expect(ok.status).toBe(200);
    expect(metrics.getGauge('sosmesh_health_database_up')).toBe(1);
  });

  it('returns 403 for operator on admin observability audit route', async () => {
    const token = operatorBearerToken({ sub: operatorId, role: UserRole.OPERATOR, teamId });
    const response = await request(app.getHttpServer())
      .get('/v1/operator/observability/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('returns 401 for unauthenticated observability routes', async () => {
    const summary = await request(app.getHttpServer()).get('/v1/operator/observability/summary');
    expect(summary.status).toBe(401);
    const audit = await request(app.getHttpServer()).get('/v1/operator/observability/audit');
    expect(audit.status).toBe(401);
  });

  it('returns 403 for operator on observability summary route', async () => {
    const token = operatorBearerToken({ sub: operatorId, role: UserRole.OPERATOR, teamId });
    const response = await request(app.getHttpServer())
      .get('/v1/operator/observability/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('allows COORDINATOR on observability summary but not audit', async () => {
    const coordinatorId = randomUUID();
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        id: coordinatorId,
        email: 'obs-coord@sosmesh.example',
        displayName: 'Obs Coord',
        role: UserRole.COORDINATOR,
        teamId,
        passwordHash: hash,
      },
    });
    const token = operatorBearerToken({
      sub: coordinatorId,
      role: UserRole.COORDINATOR,
      teamId,
      organizationId: orgId,
    });
    const summary = await request(app.getHttpServer())
      .get('/v1/operator/observability/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(summary.status).toBe(200);
    const audit = await request(app.getHttpServer())
      .get('/v1/operator/observability/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(audit.status).toBe(403);
  });

  it('returns redacted audit trail for ADMIN without coordinates or SOS text', async () => {
    const token = operatorBearerToken({ sub: adminId, role: UserRole.ADMIN, teamId });
    const response = await request(app.getHttpServer())
      .get('/v1/operator/observability/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain('5551234567');
    expect(body).not.toContain('41.015');
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items[0].action).toBe('OPERATOR_SEEN');
  });

  it('tracks AI worker queue depth through AiJobService lifecycle', async () => {
    const aiJobs = app.get(AiJobService);
    metrics.setAiQueueDepth(0);
    metrics.setWorkerStuckSeconds(0);
    const runJobSpy = jest.spyOn(aiJobs, 'runJob').mockImplementation(
      () => new Promise(() => {
        /* keep queue busy for assertion */
      })
    );
    aiJobs.enqueueAfterIngest({
      incidentId: randomUUID(),
      messageId: randomUUID(),
      tenantKey: 'tenant-48',
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(metrics.getGauge('sosmesh_ai_job_queue_depth')).toBe(1);
    runJobSpy.mockRestore();
    metrics.setAiQueueDepth(0);
    metrics.setWorkerStuckSeconds(0);
  });

  it('fires stuck-worker alert when queue depth persists with stuck seconds', () => {
    metrics.setAiQueueDepth(3);
    metrics.setWorkerStuckSeconds(130);
    const stuck = evaluatePrometheusAlerts({
      httpErrors5m: 0,
      databaseUp: 1,
      aiQueueDepth: metrics.getGauge('sosmesh_ai_job_queue_depth'),
      aiFailures5m: 0,
      ingestRateLimited5m: 0,
      gpsAnomaly5m: 0,
      workerStuckSeconds: metrics.getGauge('sosmesh_ai_worker_stuck_seconds'),
    });
    expect(stuck.find((a) => a.name === 'SosmeshAiWorkerStuck')?.firing).toBe(true);
  });

  it('keeps infra/monitoring dashboards and alert rules free of PII field names', () => {
    const root = join(__dirname, '..', '..', '..', 'infra', 'monitoring');
    const violations = scanMonitoringJsonForPii(root);
    expect(violations).toEqual([]);
  });
});
