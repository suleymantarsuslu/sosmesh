import { UserRole } from '@prisma/client';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';
import { applyTestAuthEnv, operatorBearerToken } from './helpers/operator-auth';
import { createTestOrganization } from './helpers/test-organization';

describe('Organization tenant isolation (ADIM 26)', () => {
  let app: INestApplication;
  const orgAlpha = '00000000-0000-4000-8000-000000000a01';
  const orgBeta = '00000000-0000-4000-8000-000000000b01';
  const teamAlpha = '00000000-0000-4000-8000-000000000a11';
  const teamAlphaSibling = '00000000-0000-4000-8000-000000000a12';
  const teamBeta = '00000000-0000-4000-8000-000000000b11';
  const operatorAlpha = '00000000-0000-4000-8000-000000000a21';
  const incidentAlpha = '00000000-0000-4000-8000-000000000a31';
  const incidentAlphaSibling = '00000000-0000-4000-8000-000000000a32';
  const incidentBeta = '00000000-0000-4000-8000-000000000b31';
  const password = 'test-password-16chars';
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    applyTestAuthEnv();
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);
    await createTestOrganization(prisma, {
      id: orgAlpha,
      name: 'Alpha Org',
      slug: 'alpha-org-isolation',
    });
    await createTestOrganization(prisma, {
      id: orgBeta,
      name: 'Beta Org',
      slug: 'beta-org-isolation',
    });
    await prisma.team.createMany({
      data: [
        { id: teamAlpha, name: 'alpha-team', organizationId: orgAlpha },
        { id: teamAlphaSibling, name: 'alpha-team-sibling', organizationId: orgAlpha },
        { id: teamBeta, name: 'beta-team', organizationId: orgBeta },
      ],
    });
    await prisma.user.create({
      data: {
        id: operatorAlpha,
        email: 'alpha-operator@sosmesh.example',
        displayName: 'Alpha Operator',
        role: 'OPERATOR',
        teamId: teamAlpha,
        passwordHash: hash,
      },
    });
    await prisma.incident.createMany({
      data: [
        { id: incidentAlpha, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
        { id: incidentAlphaSibling, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
        { id: incidentBeta, state: 'PENDING', version: 0, reviewStatus: 'NEW' },
      ],
    });
    await prisma.assignment.createMany({
      data: [
        { incidentId: incidentAlpha, teamId: teamAlpha, status: 'OPEN' },
        { incidentId: incidentAlphaSibling, teamId: teamAlphaSibling, status: 'OPEN' },
        { incidentId: incidentBeta, teamId: teamBeta, status: 'OPEN' },
      ],
    });
    await prisma.sosMessage.createMany({
      data: [
        {
          messageId: '00000000-0000-4000-8000-000000000a41',
          incidentId: incidentAlpha,
          locationStatus: 'UNKNOWN',
          priority: 2,
        },
        {
          messageId: '00000000-0000-4000-8000-000000000a42',
          incidentId: incidentAlphaSibling,
          locationStatus: 'UNKNOWN',
          priority: 2,
        },
        {
          messageId: '00000000-0000-4000-8000-000000000b41',
          incidentId: incidentBeta,
          locationStatus: 'UNKNOWN',
          priority: 2,
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function loginToken(): Promise<string> {
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'alpha-operator@sosmesh.example', password })
      .then((login) => {
        expect(login.status).toBe(200);
        expect(login.body.user.organizationId).toBe(orgAlpha);
        return login.body.token as string;
      });
  }

  it('returns organization context without cross-tenant incidents', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/organization/context')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.organization.id).toBe(orgAlpha);
    const ids = (response.body.incidents as { id: string }[]).map((row) => row.id);
    expect(ids).toContain(incidentAlpha);
    expect(ids).not.toContain(incidentBeta);
  });

  it('lists only in-org cases for operator', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/cases')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const incidentIds = (response.body.items as { incidentId: string }[]).map(
      (row) => row.incidentId
    );
    expect(incidentIds).toContain(incidentAlpha);
    expect(incidentIds).not.toContain(incidentBeta);
  });

  it('returns 404 for cross-org case detail', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentBeta}/detail`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  it('returns 404 for cross-org review-status mutation', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .patch(`/v1/operator/cases/${incidentBeta}/review-status`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin)
      .send({ reviewStatus: 'SEEN', expectedVersion: 0 });
    expect(response.status).toBe(404);
  });

  it('returns 404 for cross-org metadata correction', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentBeta}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin)
      .send({
        expectedVersion: 0,
        personCount: 1,
        locationStatus: 'UNKNOWN',
      });
    expect(response.status).toBe(404);
  });

  it('does not list same-org sibling team incidents for operator', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/cases')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const incidentIds = (response.body.items as { incidentId: string }[]).map(
      (row) => row.incidentId
    );
    expect(incidentIds).toContain(incidentAlpha);
    expect(incidentIds).not.toContain(incidentAlphaSibling);
  });

  it('returns 404 for same-org sibling team case detail', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentAlphaSibling}/detail`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  it('returns 404 for same-org sibling team review-status mutation', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .patch(`/v1/operator/cases/${incidentAlphaSibling}/review-status`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin)
      .send({ reviewStatus: 'SEEN', expectedVersion: 0 });
    expect(response.status).toBe(404);
  });

  it('returns 404 for same-org sibling team metadata correction', async () => {
    const token = await loginToken();
    const response = await request(app.getHttpServer())
      .post(`/v1/operator/cases/${incidentAlphaSibling}/corrections`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', allowedOrigin)
      .send({
        expectedVersion: 0,
        personCount: 1,
        locationStatus: 'UNKNOWN',
      });
    expect(response.status).toBe(404);
  });

  it('fail-closed lists no cases when JWT lacks organizationId', async () => {
    const token = operatorBearerToken({
      sub: operatorAlpha,
      role: UserRole.OPERATOR,
      teamId: teamAlpha,
    });
    const response = await request(app.getHttpServer())
      .get('/v1/operator/cases')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('returns 404 for detail when JWT lacks organizationId', async () => {
    const token = operatorBearerToken({
      sub: operatorAlpha,
      role: UserRole.OPERATOR,
      teamId: teamAlpha,
    });
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentAlpha}/detail`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  function coordinatorToken(): string {
    return operatorBearerToken({
      sub: operatorAlpha,
      role: UserRole.COORDINATOR,
      teamId: teamAlpha,
      organizationId: orgAlpha,
    });
  }

  it('COORDINATOR JWT lists all in-org team incidents', async () => {
    const token = coordinatorToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/cases')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const incidentIds = (response.body.items as { incidentId: string }[]).map(
      (row) => row.incidentId
    );
    expect(incidentIds).toContain(incidentAlpha);
    expect(incidentIds).toContain(incidentAlphaSibling);
    expect(incidentIds).not.toContain(incidentBeta);
  });

  it('COORDINATOR JWT can open sibling team case detail in same org', async () => {
    const token = coordinatorToken();
    const response = await request(app.getHttpServer())
      .get(`/v1/operator/cases/${incidentAlphaSibling}/detail`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
  });

  it('COORDINATOR JWT lists all in-org teams for assignment screens', async () => {
    const token = coordinatorToken();
    const response = await request(app.getHttpServer())
      .get('/v1/operator/teams')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const teamIds = (response.body.items as { id: string }[]).map((row) => row.id);
    expect(teamIds).toContain(teamAlpha);
    expect(teamIds).toContain(teamAlphaSibling);
    expect(teamIds).not.toContain(teamBeta);
  });
});
