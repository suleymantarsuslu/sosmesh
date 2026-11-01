import { UserRole } from '@prisma/client';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv, operatorBearerToken } from './helpers/operator-auth';
import { createTestOrganization } from './helpers/test-organization';

describe('Work tasks and coordination (ADIM 27)', () => {
  let app: INestApplication;
  const orgId = '00000000-0000-4000-8000-000000000c01';
  const teamId = '00000000-0000-4000-8000-000000000c11';
  const incidentId = '00000000-0000-4000-8000-000000000c21';
  const operatorId = '00000000-0000-4000-8000-000000000c31';
  const coordinatorId = '00000000-0000-4000-8000-000000000c32';
  const assigneeId = '00000000-0000-4000-8000-000000000c33';
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    await createTestOrganization(prisma, {
      id: orgId,
      name: 'Coord Org',
      slug: 'coord-org',
    });
    await prisma.team.create({
      data: { id: teamId, name: 'coord-team', organizationId: orgId, zoneCode: 'Z-C1' },
    });
    const hash = await bcrypt.hash('test-password-16chars', 10);
    await prisma.user.createMany({
      data: [
        {
          id: operatorId,
          email: 'coord-operator@sosmesh.example',
          displayName: 'Operator',
          role: UserRole.OPERATOR,
          teamId,
          passwordHash: hash,
        },
        {
          id: coordinatorId,
          email: 'coord-lead@sosmesh.example',
          displayName: 'Coordinator',
          role: UserRole.COORDINATOR,
          teamId,
          passwordHash: hash,
        },
        {
          id: assigneeId,
          email: 'coord-assignee@sosmesh.example',
          displayName: 'Assignee',
          role: UserRole.OPERATOR,
          teamId,
          passwordHash: hash,
        },
      ],
    });
    await prisma.incident.create({
      data: { id: incidentId, state: 'PENDING', reviewStatus: 'NEW', version: 0 },
    });
    await prisma.assignment.create({
      data: { incidentId, teamId, status: 'OPEN' },
    });
    await prisma.sosMessage.create({
      data: {
        messageId: '00000000-0000-4000-8000-000000000c41',
        incidentId,
        locationStatus: 'UNKNOWN',
        priority: 2,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function coordinatorToken(): string {
    return operatorBearerToken({
      sub: coordinatorId,
      role: UserRole.COORDINATOR,
      teamId,
      organizationId: orgId,
    });
  }

  function operatorToken(): string {
    return operatorBearerToken({
      sub: operatorId,
      role: UserRole.OPERATOR,
      teamId,
      organizationId: orgId,
    });
  }

  it('forbids operator from creating tasks', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/operator/tasks')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({
        incidentId,
        teamId,
        title: 'Blocked task',
      });
    expect(response.status).toBe(403);
  });

  it('forbids operator from assign, accept, withdraw, and close', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/operator/tasks')
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ incidentId, teamId, title: 'Operator RBAC task', assigneeId });
    expect(created.status).toBe(201);
    const taskId = created.body.id as string;
    const version = created.body.version as number;

    const assign = await request(app.getHttpServer())
      .patch(`/v1/operator/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId, expectedVersion: version });
    expect(assign.status).toBe(403);

    const accept = await request(app.getHttpServer())
      .patch(`/v1/operator/tasks/${taskId}/accept`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ expectedVersion: version });
    expect(accept.status).toBe(403);

    const withdraw = await request(app.getHttpServer())
      .patch(`/v1/operator/tasks/${taskId}/withdraw`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ expectedVersion: version });
    expect(withdraw.status).toBe(403);

    const close = await request(app.getHttpServer())
      .patch(`/v1/operator/tasks/${taskId}/close`)
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ expectedVersion: version });
    expect(close.status).toBe(403);
  });

  it('rejects AI draft assignment without assignee', async () => {
    const draft = await request(app.getHttpServer())
      .post('/v1/operator/tasks/ai-draft')
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ incidentId, teamId, title: 'Assignee required' });
    expect(draft.status).toBe(201);

    const assigned = await request(app.getHttpServer())
      .patch(`/v1/operator/tasks/${draft.body.id}/assign`)
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ expectedVersion: draft.body.version });
    expect(assigned.status).toBe(400);
    expect(assigned.body.code).toBe('ASSIGNEE_REQUIRED');
  });

  it('creates AI draft as PROPOSED only', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/operator/tasks/ai-draft')
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({
        incidentId,
        teamId,
        title: 'AI öneri taslağı',
        description: 'Onay bekliyor',
      });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('PROPOSED');
    expect(response.body.source).toBe('AI');
    expect(response.body.assigneeId).toBeNull();
  });

  it('requires coordinator approval with assignee to move AI draft to ASSIGNED', async () => {
    const draft = await request(app.getHttpServer())
      .post('/v1/operator/tasks/ai-draft')
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ incidentId, teamId, title: 'Onaylanacak taslak' });
    expect(draft.status).toBe(201);

    const assigned = await request(app.getHttpServer())
      .patch(`/v1/operator/tasks/${draft.body.id}/assign`)
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId, expectedVersion: draft.body.version });
    expect(assigned.status).toBe(200);
    expect(assigned.body.status).toBe('ASSIGNED');
    expect(assigned.body.assigneeId).toBe(assigneeId);
  });

  it('returns 409 when two coordinators assign with stale expectedVersion', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/operator/tasks')
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({
        incidentId,
        teamId,
        title: 'Concurrency task',
      });
    expect(created.status).toBe(201);
    const taskId = created.body.id as string;
    const version = created.body.version as number;

    const first = await request(app.getHttpServer())
      .patch(`/v1/operator/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ assigneeId, expectedVersion: version });
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .patch(`/v1/operator/tasks/${taskId}/accept`)
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ expectedVersion: version });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('VERSION_CONFLICT');
  });

  it('writes audit log entries for task assignment', async () => {
    const prisma = app.get(PrismaService);
    const created = await request(app.getHttpServer())
      .post('/v1/operator/tasks')
      .set('Authorization', `Bearer ${coordinatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ incidentId, teamId, title: 'Audit trail task', assigneeId });
    expect(created.status).toBe(201);

    const audits = await prisma.auditLog.findMany({
      where: { incidentId, action: 'work_task.create' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    expect(audits.length).toBeGreaterThan(0);
    const details = audits[0].detailsJson as { taskId?: string };
    expect(details.taskId).toBe(created.body.id);
  });

  it('does not return location after share grant expires', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 3600_000).toISOString();

    await request(app.getHttpServer())
      .post('/v1/operator/location-share')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ expiresAt: past, latitude: 39.9, longitude: 32.8 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/operator/location-share')
      .set('Authorization', `Bearer ${operatorToken()}`)
      .set('Origin', allowedOrigin)
      .send({ expiresAt: future, latitude: 39.9, longitude: 32.8 })
      .expect(201);

    const active = await request(app.getHttpServer())
      .get('/v1/operator/location-share/active')
      .set('Authorization', `Bearer ${coordinatorToken()}`);
    expect(active.status).toBe(200);
    expect(active.body.items.length).toBe(1);
    expect(active.body.items[0].location.latitude).toBeCloseTo(39.9, 1);

    const prisma = app.get(PrismaService);
    await prisma.locationShareGrant.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expired = await request(app.getHttpServer())
      .get('/v1/operator/location-share/active')
      .set('Authorization', `Bearer ${coordinatorToken()}`);
    expect(expired.status).toBe(200);
    expect(expired.body.items).toEqual([]);
  });
});
