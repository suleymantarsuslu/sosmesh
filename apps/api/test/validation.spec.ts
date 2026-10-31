import { INestApplication } from '@nestjs/common';
import { IncidentState } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';

const TEST_JWT_SECRET = 'test-jwt-secret-minimum-16';

describe('Operator DTO validation', () => {
  let app: INestApplication;
  let incidentId: string;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
    const prisma = app.get(PrismaService);
    const incident = await prisma.incident.create({
      data: { state: IncidentState.PENDING },
    });
    incidentId = incident.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 400 VALIDATION_ERROR for invalid message body', async () => {
    const token = jwt.sign({ sub: 'operator-test', role: 'OPERATOR' }, TEST_JWT_SECRET);
    const response = await request(app.getHttpServer())
      .post('/v1/operator/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messageId: 'not-a-uuid',
        incidentId,
        unknownField: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.body.message)).not.toMatch(/encrypted/i);
  });
});
