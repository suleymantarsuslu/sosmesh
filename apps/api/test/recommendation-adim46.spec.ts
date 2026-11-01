import {
  LocationStatus,
  ResourceKind,
  UserRole,
} from '@prisma/client';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { getAiRunMetrics, resetAiRunMetricsForTests } from '../src/ai/ai-metrics';
import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv, operatorBearerToken } from './helpers/operator-auth';
import { createTestOrganization } from './helpers/test-organization';

describe('Assignment recommendations (ADIM 46)', () => {
  let app: INestApplication;
  const orgId = '00000000-0000-4000-8000-000000000d01';
  const teamId = '00000000-0000-4000-8000-000000000d11';
  const incidentId = '00000000-0000-4000-8000-000000000d21';
  const staleIncidentId = '00000000-0000-4000-8000-000000000d22';
  const noResourceOrgId = '00000000-0000-4000-8000-000000000d03';
  const noResourceTeamId = '00000000-0000-4000-8000-000000000d13';
  const noResourceIncidentId = '00000000-0000-4000-8000-000000000d23';
  const operatorId = '00000000-0000-4000-8000-000000000d31';
  const coordinatorId = '00000000-0000-4000-8000-000000000d32';
  const assigneeId = '00000000-0000-4000-8000-000000000d33';
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    applyTestAuthEnv();
    process.env.AI_RECOMMENDATION_RATIONALE_ENABLED = 'false';
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    await createTestOrganization(prisma, {
      id: orgId,
      name: 'Rec Org',
      slug: 'rec-org',
    });
    await createTestOrganization(prisma, {
      id: noResourceOrgId,
      name: 'Empty Org',
      slug: 'empty-org-rec',
    });
    await prisma.team.createMany({
      data: [
        { id: teamId, name: 'rec-team', organizationId: orgId, zoneCode: 'SYNTH-Z1' },
        { id: noResourceTeamId, name: 'empty-team', organizationId: noResourceOrgId },
      ],
    });
    const hash = await bcrypt.hash('test-password-16chars', 10);
    await prisma.user.createMany({
      data: [
        {
          id: operatorId,
          email: 'rec-operator@sosmesh.example',
          displayName: 'Operator',
          role: UserRole.OPERATOR,
          teamId,
          passwordHash: hash,
        },
        {
          id: coordinatorId,
          email: 'rec-coordinator@sosmesh.example',
          displayName: 'Coordinator',
          role: UserRole.COORDINATOR,
          teamId,
          passwordHash: hash,
        },
        {
          id: assigneeId,
          email: 'rec-assignee@sosmesh.example',
          displayName: 'Assignee',
          role: UserRole.OPERATOR,
          teamId,
          passwordHash: hash,
        },
      ],
    });
    await prisma.incident.createMany({
      data: [
        { id: incidentId, state: 'PENDING' },
        { id: staleIncidentId, state: 'PENDING' },
        { id: noResourceIncidentId, state: 'PENDING' },
      ],
    });
    await prisma.assignment.createMany({
      data: [
        { incidentId, teamId, status: 'OPEN' },
        { incidentId: staleIncidentId, teamId, status: 'OPEN' },
        { incidentId: noResourceIncidentId, teamId: noResourceTeamId, status: 'OPEN' },
      ],
    });
    const old = new Date(Date.now() - 4 * 60 * 60_000);
    await prisma.sosMessage.createMany({
      data: [
        {
          messageId: '00000000-0000-4000-8000-000000000d41',
          incidentId,
          locationStatus: LocationStatus.GPS,
          latitude: 39.925,
          longitude: 32.836,
          accuracyMeters: 2500,
          receivedAt: new Date(),
        },
        {
          messageId: '00000000-0000-4000-8000-000000000d42',
          incidentId: staleIncidentId,
          locationStatus: LocationStatus.GPS,
          latitude: 39.925,
          longitude: 32.836,
          accuracyMeters: 100,
          receivedAt: old,
        },
        {
          messageId: '00000000-0000-4000-8000-000000000d43',
          incidentId: noResourceIncidentId,
          locationStatus: LocationStatus.UNKNOWN,
          receivedAt: new Date(),
        },
      ],
    });
    await prisma.resource.createMany({
      data: [
        {
          id: '00000000-0000-4000-8000-000000000d51',
          organizationId: orgId,
          teamId,
          kind: ResourceKind.FIELD_TEAM,
          name: 'available-unit',
          capacity: 2,
          zoneCode: 'SYNTH-Z1',
        },
        {
          id: '00000000-0000-4000-8000-000000000d52',
          organizationId: orgId,
          teamId,
          kind: ResourceKind.VEHICLE,
          name: 'busy-vehicle',
          capacity: 1,
          zoneCode: 'SYNTH-RESCUE-B',
          availableUntil: new Date(Date.now() - 60_000),
        },
      ],
    });
  });

  beforeEach(() => {
    resetAiRunMetricsForTests();
  });

  const coordinatorToken = () =>
    operatorBearerToken({
      sub: coordinatorId,
      role: UserRole.COORDINATOR,
      teamId,
      organizationId: orgId,
    });

  const operatorToken = () =>
    operatorBearerToken({
      sub: operatorId,
      role: UserRole.OPERATOR,
      teamId,
      organizationId: orgId,
    });

  it('plans recommendations with unavailable resource and GPS warnings', async () => {
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${incidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin);
    expect(plan.status).toBe(201);
    expect(plan.body.items.length).toBeGreaterThan(0);
    const top = plan.body.items[0];
    expect(top.disclaimer).toMatch(/karar koordinatör/i);
    expect(top.missingInfo.some((line: string) => line.includes('GPS'))).toBe(true);
    const unavailable = plan.body.items.find(
      (row: { resourceName: string | null }) => row.resourceName === 'busy-vehicle'
    );
    expect(unavailable.available).toBe(false);
  });

  it('marks stale case in missing info', async () => {
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${staleIncidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin);
    expect(plan.status).toBe(201);
    expect(plan.body.items[0].missingInfo.some((line: string) => line.includes('bayat'))).toBe(
      true
    );
  });

  it('returns empty recommendations when org has no approved resources', async () => {
    const token = operatorBearerToken({
      sub: operatorId,
      role: UserRole.OPERATOR,
      teamId: noResourceTeamId,
      organizationId: noResourceOrgId,
    });
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${noResourceIncidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin);
    expect(plan.status).toBe(201);
    expect(plan.body.items).toEqual([]);
  });

  it('allows operators to reject proposals without creating tasks', async () => {
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${incidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin);
    const recommendationId = plan.body.items[0].id as string;
    const rejected = await request(app.getHttpServer())
      .patch(`/v1/operator/recommendations/${recommendationId}/reject`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin);
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('REJECTED');
    const prisma = app.get(PrismaService);
    const tasks = await prisma.workTask.count({ where: { incidentId } });
    expect(tasks).toBe(0);
  });

  it('returns 403 when operator attempts coordinator confirm', async () => {
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${incidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin);
    const available = plan.body.items.find((row: { available: boolean }) => row.available);
    expect(available).toBeDefined();
    const confirm = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${available.id}/confirm`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId });
    expect(confirm.status).toBe(403);
  });

  it('commits assignment only after coordinator confirm with assignee', async () => {
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${incidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin);
    const available = plan.body.items.find((row: { available: boolean }) => row.available);
    const confirm = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${available.id}/confirm`)
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId });
    expect(confirm.status).toBe(201);
    expect(confirm.body.taskId).toBeTruthy();
    expect(confirm.body.recommendation.status).toBe('CONFIRMED');
    const prisma = app.get(PrismaService);
    const task = await prisma.workTask.findUnique({ where: { id: confirm.body.taskId } });
    expect(task?.status).toBe('ASSIGNED');
    expect(task?.source).toBe('AI');
  });

  it('records operator feedback for AI scoring without live training flag', async () => {
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${incidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin);
    const recommendationId = plan.body.items[0].id as string;
    const feedback = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${recommendationId}/feedback`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ rating: 'NOT_HELPFUL', note: 'Mesafe belirsiz' });
    expect(feedback.status).toBe(201);
    expect(feedback.body.capturedForScoring).toBe(true);
    const metrics = getAiRunMetrics().getSnapshot();
    expect(metrics.recommendationFeedbackNotHelpful).toBe(1);
    const prisma = app.get(PrismaService);
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'recommendation.feedback' },
      orderBy: { createdAt: 'desc' },
    });
    const details = audit?.detailsJson as { liveTraining?: boolean };
    expect(details.liveTraining).toBe(false);
  });
});
