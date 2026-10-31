import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv, operatorBearerToken } from './helpers/operator-auth';

describe('Auth and operator RBAC', () => {
  let app: INestApplication;
  const teamA = '00000000-0000-4000-8000-000000000101';
  const teamB = '00000000-0000-4000-8000-000000000102';
  const incidentScoped = '00000000-0000-4000-8000-000000000201';
  const incidentOther = '00000000-0000-4000-8000-000000000202';
  const operatorA = '00000000-0000-4000-8000-000000000301';
  const password = 'test-password-16chars';

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await prisma.team.createMany({
      data: [
        { id: teamA, name: 'team-a' },
        { id: teamB, name: 'team-b' },
      ],
      skipDuplicates: true,
    });
    await prisma.user.create({
      data: {
        id: operatorA,
        email: 'operator-a@sosmesh.test',
        displayName: 'Operator A',
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
    await prisma.assignment.create({
      data: {
        incidentId: incidentScoped,
        teamId: teamA,
        status: 'OPEN',
      },
    });
    await prisma.assignment.create({
      data: {
        incidentId: incidentOther,
        teamId: teamB,
        status: 'OPEN',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 for login with wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'operator-a@sosmesh.test', password: 'wrong-password-xyz' });
    expect(response.status).toBe(401);
  });

  it('returns 401 when operator endpoint is called without auth', async () => {
    const response = await request(app.getHttpServer()).get('/v1/operator/incidents');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when operator role calls admin endpoint', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'operator-a@sosmesh.test', password });
    expect(login.status).toBe(200);
    const token = login.body.token as string;
    const response = await request(app.getHttpServer())
      .get('/v1/operator/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('lists only team-scoped incidents for operator', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'operator-a@sosmesh.test', password });
    const token = login.body.token as string;
    const response = await request(app.getHttpServer())
      .get('/v1/operator/incidents')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const ids = (response.body.items as { id: string }[]).map((i) => i.id);
    expect(ids).toContain(incidentScoped);
    expect(ids).not.toContain(incidentOther);
  });

  it('returns 404 for out-of-scope incident detail', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'operator-a@sosmesh.test', password });
    const token = login.body.token as string;
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/incidents/${incidentOther}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  it('allows legacy test bearer for sync endpoints', async () => {
    const token = operatorBearerToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/events')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
  });
});
