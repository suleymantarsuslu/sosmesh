import { INestApplication } from '@nestjs/common';
import { IncidentState } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';

const TEST_JWT_SECRET = 'test-jwt-secret-minimum-16';

describe('Duplicate message_id conflict', () => {
  let app: INestApplication;
  let incidentId: string;
  const messageId = '11111111-1111-4111-8111-111111111111';

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

  it('returns 409 DUPLICATE_MESSAGE_ID on second insert with same message_id', async () => {
    const token = jwt.sign({ sub: 'operator-test', role: 'OPERATOR' }, TEST_JWT_SECRET);
    const payload = {
      messageId,
      incidentId,
      encryptedNoteBlob: 'opaque-ciphertext-block-abcdef12',
    };

    const first = await request(app.getHttpServer())
      .post('/v1/operator/messages')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/v1/operator/messages')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('DUPLICATE_MESSAGE_ID');
  });
});
