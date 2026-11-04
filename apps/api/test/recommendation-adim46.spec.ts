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
  const orgId = '00000000-0000-4000-8000-000000000461';
  const teamId = '00000000-0000-4000-8000-000000000462';
  const incidentId = '00000000-0000-4000-8000-000000000463';
  const staleIncidentId = '00000000-0000-4000-8000-000000000464';
  const noResourceOrgId = '00000000-0000-4000-8000-000000000465';
  const noResourceTeamId = '00000000-0000-4000-8000-000000000466';
  const noResourceIncidentId = '00000000-0000-4000-8000-000000000467';
  const operatorId = '00000000-0000-4000-8000-000000000468';
  const coordinatorId = '00000000-0000-4000-8000-000000000469';
  const assigneeId = '00000000-0000-4000-8000-00000000046a';
  const allowedOrigin = 'http://localhost:3000';
  const rationaleRationaleEnabled = process.env.AI_RECOMMENDATION_RATIONALE_ENABLED;

  beforeAll(async () => {
    applyTestAuthEnv();
    process.env.AI_RECOMMENDATION_RATIONALE_ENABLED = 'false';
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    await createTestOrganization(prisma, {
      id: orgId,
      name: 'Rec Org',
      slug: 'rec-org-46',
    });
    await createTestOrganization(prisma, {
      id: noResourceOrgId,
      name: 'Empty Org',
      slug: 'empty-org-rec-46',
    });
    await prisma.team.createMany({
      data: [
        { id: teamId, name: 'rec-team-46', organizationId: orgId, zoneCode: 'SYNTH-Z1' },
        { id: noResourceTeamId, name: 'empty-team-46', organizationId: noResourceOrgId },
      ],
    });
    const hash = await bcrypt.hash('test-password-16chars', 10);
    await prisma.user.createMany({
      data: [
        {
          id: operatorId,
          email: 'rec-operator-46@sosmesh.example',
          displayName: 'Operator',
          role: UserRole.OPERATOR,
          teamId,
          passwordHash: hash,
        },
        {
          id: coordinatorId,
          email: 'rec-coordinator-46@sosmesh.example',
          displayName: 'Coordinator',
          role: UserRole.COORDINATOR,
          teamId,
          passwordHash: hash,
        },
        {
          id: assigneeId,
          email: 'rec-assignee-46@sosmesh.example',
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
          messageId: '00000000-0000-4000-8000-00000000046b',
          incidentId,
          locationStatus: LocationStatus.GPS,
          latitude: 39.925,
          longitude: 32.836,
          accuracyMeters: 2500,
          receivedAt: new Date(),
        },
        {
          messageId: '00000000-0000-4000-8000-00000000046c',
          incidentId: staleIncidentId,
          locationStatus: LocationStatus.GPS,
          latitude: 39.925,
          longitude: 32.836,
          accuracyMeters: 100,
          receivedAt: old,
        },
        {
          messageId: '00000000-0000-4000-8000-00000000046d',
          incidentId: noResourceIncidentId,
          locationStatus: LocationStatus.UNKNOWN,
          receivedAt: new Date(),
        },
      ],
    });
    await prisma.resource.createMany({
      data: [
        {
          id: '00000000-0000-4000-8000-00000000046e',
          organizationId: orgId,
          teamId,
          kind: ResourceKind.FIELD_TEAM,
          name: 'available-unit',
          capacity: 2,
          zoneCode: 'SYNTH-Z1',
        },
        {
          id: '00000000-0000-4000-8000-00000000046f',
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

  afterAll(async () => {
    if (rationaleRationaleEnabled === undefined) {
      delete process.env.AI_RECOMMENDATION_RATIONALE_ENABLED;
    } else {
      process.env.AI_RECOMMENDATION_RATIONALE_ENABLED = rationaleRationaleEnabled;
    }
    await app.close();
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

  async function seedIncidentWithFreshResource(
    prisma: PrismaService,
    ids: {
      incidentId: string;
      messageId: string;
      orgId: string;
      teamId: string;
      resourceId: string;
      assigneeId: string;
      coordinatorId: string;
    }
  ): Promise<void> {
    const hash = await bcrypt.hash('test-password-16chars', 10);
    await createTestOrganization(prisma, {
      id: ids.orgId,
      name: `Rec Org ${ids.orgId.slice(-4)}`,
      slug: `rec-org-${ids.orgId.slice(-8)}`,
    });
    await prisma.team.create({
      data: {
        id: ids.teamId,
        name: `rec-team-${ids.teamId.slice(-4)}`,
        organizationId: ids.orgId,
        zoneCode: 'SYNTH-Z1',
      },
    });
    await prisma.user.createMany({
      data: [
        {
          id: ids.coordinatorId,
          email: `rec-coord-${ids.coordinatorId.slice(-4)}@sosmesh.example`,
          displayName: 'Coordinator',
          role: UserRole.COORDINATOR,
          teamId: ids.teamId,
          passwordHash: hash,
        },
        {
          id: ids.assigneeId,
          email: `rec-assignee-${ids.assigneeId.slice(-4)}@sosmesh.example`,
          displayName: 'Assignee',
          role: UserRole.OPERATOR,
          teamId: ids.teamId,
          passwordHash: hash,
        },
      ],
    });
    await prisma.resource.create({
      data: {
        id: ids.resourceId,
        organizationId: ids.orgId,
        teamId: ids.teamId,
        kind: ResourceKind.FIELD_TEAM,
        name: `unit-${ids.resourceId.slice(-4)}`,
        capacity: 8,
        zoneCode: 'SYNTH-Z1',
      },
    });
    await prisma.incident.create({ data: { id: ids.incidentId, state: 'PENDING' } });
    await prisma.assignment.create({
      data: { incidentId: ids.incidentId, teamId: ids.teamId, status: 'OPEN' },
    });
    await prisma.sosMessage.create({
      data: {
        messageId: ids.messageId,
        incidentId: ids.incidentId,
        locationStatus: LocationStatus.GPS,
        latitude: 39.925,
        longitude: 32.836,
        accuracyMeters: 2500,
        receivedAt: new Date(),
      },
    });
  }

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
    expect(plan.body.items.length).toBeGreaterThan(0);
    const targetId = plan.body.items[0].id as string;
    const confirm = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${targetId}/confirm`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId });
    expect(confirm.status).toBe(403);
    expect(confirm.body.code).toBe('FORBIDDEN');
  });

  it('commits assignment only after coordinator confirm with assignee', async () => {
    const prisma = app.get(PrismaService);
    const confirmIncidentId = '00000000-0000-4000-8000-000000000475';
    const confirmOrgId = '00000000-0000-4000-8000-000000000484';
    const confirmTeamId = '00000000-0000-4000-8000-00000000047b';
    const confirmResourceId = '00000000-0000-4000-8000-00000000047c';
    const confirmAssigneeId = '00000000-0000-4000-8000-000000000481';
    const confirmCoordinatorId = '00000000-0000-4000-8000-000000000485';
    await seedIncidentWithFreshResource(prisma, {
      incidentId: confirmIncidentId,
      messageId: '00000000-0000-4000-8000-000000000476',
      orgId: confirmOrgId,
      teamId: confirmTeamId,
      resourceId: confirmResourceId,
      assigneeId: confirmAssigneeId,
      coordinatorId: confirmCoordinatorId,
    });
    const confirmCoordToken = operatorBearerToken({
      sub: confirmCoordinatorId,
      role: UserRole.COORDINATOR,
      teamId: confirmTeamId,
      organizationId: confirmOrgId,
    });
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${confirmIncidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${confirmCoordToken}`)
      .set('Origin', allowedOrigin);
    const available = plan.body.items.find((row: { available: boolean }) => row.available);
    expect(available).toBeDefined();
    const confirm = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${available.id}/confirm`)
      .set('Authorization', `Bearer ${confirmCoordToken}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId: confirmAssigneeId });
    expect(confirm.status).toBe(201);
    expect(confirm.body.taskId).toBeTruthy();
    expect(confirm.body.recommendation.status).toBe('CONFIRMED');
    const task = await prisma.workTask.findUnique({ where: { id: confirm.body.taskId } });
    expect(task?.status).toBe('ASSIGNED');
    expect(task?.source).toBe('AI');
  });

  it('confirms a recommendation for a selected team without an individual assignee', async () => {
    const prisma = app.get(PrismaService);
    const ids = {
      incidentId: '00000000-0000-4000-8000-0000000004a1',
      messageId: '00000000-0000-4000-8000-0000000004a2',
      orgId: '00000000-0000-4000-8000-0000000004a3',
      teamId: '00000000-0000-4000-8000-0000000004a4',
      resourceId: '00000000-0000-4000-8000-0000000004a5',
      assigneeId: '00000000-0000-4000-8000-0000000004a6',
      coordinatorId: '00000000-0000-4000-8000-0000000004a7',
    };
    const otherTeamId = '00000000-0000-4000-8000-0000000004a8';
    await seedIncidentWithFreshResource(prisma, ids);
    await prisma.team.create({
      data: {
        id: otherTeamId,
        name: 'rec-other-team-4a8',
        organizationId: ids.orgId,
        zoneCode: 'SYNTH-Z1',
      },
    });
    const token = operatorBearerToken({
      sub: ids.coordinatorId,
      role: UserRole.COORDINATOR,
      teamId: ids.teamId,
      organizationId: ids.orgId,
    });
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${ids.incidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin);
    const available = plan.body.items.find((row: { available: boolean }) => row.available);
    expect(available.workTask).toBeNull();

    // Nothing is dispatched by planning alone.
    expect(await prisma.workTask.count({ where: { incidentId: ids.incidentId } })).toBe(0);

    const confirm = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${available.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin)
      .send({ teamId: otherTeamId });
    expect(confirm.status).toBe(201);
    expect(confirm.body.recommendation.status).toBe('CONFIRMED');
    expect(confirm.body.recommendation.confirmedAt).toBeTruthy();
    expect(confirm.body.recommendation.workTask).toMatchObject({
      id: confirm.body.taskId,
      status: 'ASSIGNED',
      teamId: otherTeamId,
      teamName: 'rec-other-team-4a8',
      assigneeDisplayName: null,
    });

    const task = await prisma.workTask.findUnique({ where: { id: confirm.body.taskId } });
    expect(task).toMatchObject({
      status: 'ASSIGNED',
      source: 'AI',
      teamId: otherTeamId,
      assigneeId: null,
      resourceId: null,
      incidentId: ids.incidentId,
    });

    const tasks = await request(app.getHttpServer())
      .get(`/v1/operator/tasks?incidentId=${ids.incidentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(tasks.status).toBe(200);
    expect(tasks.body.items).toHaveLength(1);
    expect(tasks.body.items[0]).toMatchObject({
      teamId: otherTeamId,
      teamName: 'rec-other-team-4a8',
      status: 'ASSIGNED',
    });

    const audits = await prisma.auditLog.findMany({
      where: { incidentId: ids.incidentId },
      select: { action: true, detailsJson: true },
    });
    const actions = audits.map((row) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining(['recommendation.confirm', 'work_task.assign_team'])
    );
    const confirmAudit = audits.find((row) => row.action === 'recommendation.confirm');
    expect(confirmAudit?.detailsJson).toMatchObject({
      workTaskId: confirm.body.taskId,
      after: { teamId: otherTeamId, teamName: 'rec-other-team-4a8', teamOverridden: true },
    });

    // Reload shows the confirmed state with the team that was tasked.
    const listed = await request(app.getHttpServer())
      .get(`/v1/operator/incidents/${ids.incidentId}/recommendations`)
      .set('Authorization', `Bearer ${token}`);
    const confirmedRow = listed.body.items.find((row: { id: string }) => row.id === available.id);
    expect(confirmedRow.workTask.teamName).toBe('rec-other-team-4a8');
  });

  it('rejects confirm for a team outside the coordinator organization', async () => {
    const prisma = app.get(PrismaService);
    const ids = {
      incidentId: '00000000-0000-4000-8000-0000000004b1',
      messageId: '00000000-0000-4000-8000-0000000004b2',
      orgId: '00000000-0000-4000-8000-0000000004b3',
      teamId: '00000000-0000-4000-8000-0000000004b4',
      resourceId: '00000000-0000-4000-8000-0000000004b5',
      assigneeId: '00000000-0000-4000-8000-0000000004b6',
      coordinatorId: '00000000-0000-4000-8000-0000000004b7',
    };
    await seedIncidentWithFreshResource(prisma, ids);
    const token = operatorBearerToken({
      sub: ids.coordinatorId,
      role: UserRole.COORDINATOR,
      teamId: ids.teamId,
      organizationId: ids.orgId,
    });
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${ids.incidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin);
    const available = plan.body.items.find((row: { available: boolean }) => row.available);
    const confirm = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${available.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin)
      .send({ teamId });
    expect(confirm.status).toBe(404);
    expect(await prisma.workTask.count({ where: { incidentId: ids.incidentId } })).toBe(0);
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

  it('returns NOT_FOUND for cross-organization recommendation plan (IDOR)', async () => {
    const prisma = app.get(PrismaService);
    const otherOrgId = '00000000-0000-4000-8000-000000000470';
    const otherTeamId = '00000000-0000-4000-8000-000000000471';
    const otherOperatorId = '00000000-0000-4000-8000-000000000472';
    const hash = await bcrypt.hash('test-password-16chars', 10);
    await createTestOrganization(prisma, {
      id: otherOrgId,
      name: 'rec-other-org',
      slug: 'rec-other-org-46',
    });
    await prisma.team.create({
      data: { id: otherTeamId, name: 'rec-other-team', organizationId: otherOrgId },
    });
    await prisma.user.create({
      data: {
        id: otherOperatorId,
        email: 'rec-other-op-46@sosmesh.example',
        displayName: 'Other Op',
        role: UserRole.OPERATOR,
        teamId: otherTeamId,
        passwordHash: hash,
      },
    });
    const token = operatorBearerToken({
      sub: otherOperatorId,
      role: UserRole.OPERATOR,
      teamId: otherTeamId,
      organizationId: otherOrgId,
    });
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${incidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('returns 403 for recommendation POST without allowed Origin (CSRF guard)', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('Origin', allowedOrigin)
      .send({ email: 'rec-operator-46@sosmesh.example', password: 'test-password-16chars' });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'];
    const blocked = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${incidentId}/recommendations/plan`)
      .set('Cookie', cookie)
      .set('Origin', 'http://attacker.example');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('CSRF_FORBIDDEN');
  });

  it('rejects second confirm on the same recommendation (idempotent guard)', async () => {
    const prisma = app.get(PrismaService);
    const idempotentIncidentId = '00000000-0000-4000-8000-000000000477';
    const idempotentOrgId = '00000000-0000-4000-8000-000000000486';
    const idempotentTeamId = '00000000-0000-4000-8000-00000000047d';
    const idempotentResourceId = '00000000-0000-4000-8000-00000000047e';
    const idempotentAssigneeId = '00000000-0000-4000-8000-000000000482';
    const idempotentCoordinatorId = '00000000-0000-4000-8000-000000000487';
    await seedIncidentWithFreshResource(prisma, {
      incidentId: idempotentIncidentId,
      messageId: '00000000-0000-4000-8000-000000000478',
      orgId: idempotentOrgId,
      teamId: idempotentTeamId,
      resourceId: idempotentResourceId,
      assigneeId: idempotentAssigneeId,
      coordinatorId: idempotentCoordinatorId,
    });
    const idempotentCoordToken = operatorBearerToken({
      sub: idempotentCoordinatorId,
      role: UserRole.COORDINATOR,
      teamId: idempotentTeamId,
      organizationId: idempotentOrgId,
    });
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${idempotentIncidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${idempotentCoordToken}`)
      .set('Origin', allowedOrigin);
    const available = plan.body.items.find((row: { available: boolean }) => row.available);
    expect(available).toBeDefined();
    const first = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${available.id}/confirm`)
      .set('Authorization', `Bearer ${idempotentCoordToken}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId: idempotentAssigneeId });
    expect(first.status).toBe(201);
    const second = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${available.id}/confirm`)
      .set('Authorization', `Bearer ${idempotentCoordToken}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId: idempotentAssigneeId });
    expect(second.status).toBe(400);
    expect(second.body.code).toBe('INVALID_STATE');
    const tasks = await prisma.workTask.count({
      where: { incidentId: idempotentIncidentId, source: 'AI', status: 'ASSIGNED' },
    });
    expect(tasks).toBe(1);
  });

  it('rejects confirm after operator rejection', async () => {
    const prisma = app.get(PrismaService);
    const rejectIncidentId = '00000000-0000-4000-8000-000000000479';
    const rejectOrgId = '00000000-0000-4000-8000-000000000488';
    const rejectTeamId = '00000000-0000-4000-8000-00000000047f';
    const rejectResourceId = '00000000-0000-4000-8000-000000000480';
    const rejectAssigneeId = '00000000-0000-4000-8000-000000000483';
    const rejectCoordinatorId = '00000000-0000-4000-8000-000000000489';
    await seedIncidentWithFreshResource(prisma, {
      incidentId: rejectIncidentId,
      messageId: '00000000-0000-4000-8000-00000000047a',
      orgId: rejectOrgId,
      teamId: rejectTeamId,
      resourceId: rejectResourceId,
      assigneeId: rejectAssigneeId,
      coordinatorId: rejectCoordinatorId,
    });
    const rejectCoordToken = operatorBearerToken({
      sub: rejectCoordinatorId,
      role: UserRole.COORDINATOR,
      teamId: rejectTeamId,
      organizationId: rejectOrgId,
    });
    const plan = await request(app.getHttpServer())
      .post(`/v1/operator/incidents/${rejectIncidentId}/recommendations/plan`)
      .set('Authorization', `Bearer ${rejectCoordToken}`)
      .set('Origin', allowedOrigin);
    const target = plan.body.items.find((row: { available: boolean }) => row.available);
    expect(target).toBeDefined();
    const rejected = await request(app.getHttpServer())
      .patch(`/v1/operator/recommendations/${target.id}/reject`)
      .set('Authorization', `Bearer ${rejectCoordToken}`)
      .set('Origin', allowedOrigin);
    expect(rejected.status).toBe(200);
    const confirm = await request(app.getHttpServer())
      .post(`/v1/operator/recommendations/${target.id}/confirm`)
      .set('Authorization', `Bearer ${rejectCoordToken}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId: rejectAssigneeId });
    expect(confirm.status).toBe(400);
    expect(confirm.body.code).toBe('INVALID_STATE');
  });

  it('stores AI rationale only when opt-in enabled and redacts PII from operator text', async () => {
    const prisma = app.get(PrismaService);
    const rationaleIncidentId = '00000000-0000-4000-8000-000000000473';
    await prisma.incident.create({ data: { id: rationaleIncidentId, state: 'PENDING' } });
    await prisma.assignment.create({
      data: { incidentId: rationaleIncidentId, teamId, status: 'OPEN' },
    });
    const syntheticLat = '12.3456';
    const syntheticLon = '54.3210';
    const coordPair = `${syntheticLat},${syntheticLon}`;
    await prisma.sosMessage.create({
      data: {
        messageId: '00000000-0000-4000-8000-000000000474',
        incidentId: rationaleIncidentId,
        locationStatus: LocationStatus.UNKNOWN,
        operatorDisplayText: `yardım ${coordPair} victim@example.com`,
        receivedAt: new Date(),
      },
    });

    process.env.AI_RECOMMENDATION_RATIONALE_ENABLED = 'true';
    const plan = await request(app.getHttpServer())
      .post(
        `/v1/operator/incidents/${rationaleIncidentId}/recommendations/plan?includeAiRationale=true`
      )
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin);
    process.env.AI_RECOMMENDATION_RATIONALE_ENABLED = 'false';
    expect(plan.status).toBe(201);
    const withRationale = plan.body.items.find(
      (row: { aiRationale: string | null }) => row.aiRationale
    );
    expect(withRationale).toBeDefined();
    const rationaleText = withRationale.aiRationale as string;
    expect(rationaleText).not.toMatch(/victim@example\.com/);
    expect(rationaleText).not.toContain(syntheticLat);
    expect(rationaleText).not.toMatch(/treatment_plan|triage_decision|dispatch_now/i);
    expect(rationaleText).toMatch(/koordinatör|Deterministik|aciliyet/i);
  });
});
