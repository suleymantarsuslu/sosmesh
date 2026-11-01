import { UserRole } from '@prisma/client';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationDispatchService } from '../src/notifications/notification-dispatch.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv, operatorBearerToken } from './helpers/operator-auth';
import { createTestOrganization } from './helpers/test-organization';

describe('Notifications and activity (ADIM 28)', () => {
  let app: INestApplication;
  const orgId = '00000000-0000-4000-8000-000000000d01';
  const teamId = '00000000-0000-4000-8000-000000000d11';
  const incidentId = '00000000-0000-4000-8000-000000000d21';
  const userA = '00000000-0000-4000-8000-000000000d31';
  const userB = '00000000-0000-4000-8000-000000000d32';
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    await createTestOrganization(prisma, {
      id: orgId,
      name: 'Notify Org',
      slug: 'notify-org',
    });
    await prisma.team.create({
      data: { id: teamId, name: 'notify-team', organizationId: orgId },
    });
    const hash = await bcrypt.hash('test-password-16chars', 10);
    await prisma.user.createMany({
      data: [
        {
          id: userA,
          email: 'notify-a@sosmesh.example',
          displayName: 'Coord A',
          role: UserRole.COORDINATOR,
          teamId,
          passwordHash: hash,
        },
        {
          id: userB,
          email: 'notify-b@sosmesh.example',
          displayName: 'Coord B',
          role: UserRole.COORDINATOR,
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
        messageId: '00000000-0000-4000-8000-000000000d41',
        incidentId,
        locationStatus: 'UNKNOWN',
        priority: 2,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function token(sub: string): string {
    return operatorBearerToken({
      sub,
      role: UserRole.COORDINATOR,
      teamId,
      organizationId: orgId,
    });
  }

  it('dedupes notifications when the same task event is dispatched twice', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/operator/tasks')
      .set('Authorization', `Bearer ${token(userA)}`)
      .set('Origin', allowedOrigin)
      .send({ incidentId, teamId, title: 'Notify once' });
    expect(created.status).toBe(201);

    const prisma = app.get(PrismaService);
    const dispatch = app.get(NotificationDispatchService);
    const task = await prisma.workTask.findUniqueOrThrow({
      where: { id: created.body.id as string },
    });
    const actor = {
      sub: userA,
      role: UserRole.COORDINATOR,
      teamId,
      organizationId: orgId,
    };
    await dispatch.notifyTaskEvent(actor, task, 'work_task.created');
    await dispatch.notifyTaskEvent(actor, task, 'work_task.created');

    const rows = await prisma.operatorNotification.findMany({
      where: { userId: userB, eventType: 'work_task.created', dedupeKey: `${'work_task.created'}:${task.id}:${task.version}:${task.status}` },
    });
    expect(rows.length).toBe(1);
  });

  it('respects quiet hours by skipping delivery state', async () => {
    const prisma = app.get(PrismaService);
    await prisma.notificationPreference.upsert({
      where: { userId: userB },
      create: {
        userId: userB,
        quietHoursStart: 0,
        quietHoursEnd: 1440,
      },
      update: {
        quietHoursStart: 0,
        quietHoursEnd: 1440,
      },
    });

    const created = await request(app.getHttpServer())
      .post('/v1/operator/tasks')
      .set('Authorization', `Bearer ${token(userA)}`)
      .set('Origin', allowedOrigin)
      .send({ incidentId, teamId, title: 'Quiet hours task' });
    expect(created.status).toBe(201);

    const latest = await prisma.operatorNotification.findFirst({
      where: { userId: userB },
      orderBy: { createdAt: 'desc' },
    });
    expect(latest?.deliveryState).toBe('SKIPPED_QUIET_HOURS');

    await prisma.notificationPreference.update({
      where: { userId: userB },
      data: { quietHoursStart: null, quietHoursEnd: null },
    });
  });

  it('lists activity timeline for scoped incident', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/activity?incidentId=${incidentId}`)
      .set('Authorization', `Bearer ${token(userA)}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThan(0);
  });

  it('export activity omits raw coordinates from audit payloads', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/activity/export?incidentId=${incidentId}`)
      .set('Authorization', `Bearer ${token(userA)}`);
    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body.items);
    expect(serialized).not.toMatch(/"latitude"\s*:/);
    expect(serialized).not.toMatch(/"longitude"\s*:/);
  });

  it('forbids operator role from exporting activity', async () => {
    const opToken = operatorBearerToken({
      sub: userA,
      role: UserRole.OPERATOR,
      teamId,
      organizationId: orgId,
    });
    const response = await request(app.getHttpServer())
      .get('/v1/operator/activity/export')
      .set('Authorization', `Bearer ${opToken}`);
    expect(response.status).toBe(403);
  });
});
