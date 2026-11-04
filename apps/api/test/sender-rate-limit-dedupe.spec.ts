import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { buildValidIngestRequest } from './helpers/build-ingest-packet';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';

describe('Sender rate limit - dedupe bypass', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows dedupe ingest without counting against per-sender rate limit', async () => {
    const messageId = 'dedupe-test-1111-4111-8111-111111111111';
    const body = buildValidIngestRequest({ messageId });
    
    const first = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(first.status).toBe(200);
    expect(first.body.receipt.messageId).toBe(messageId);
    const firstToken = first.body.receipt.uploadToken;
    expect(firstToken).toBeTruthy();

    const second = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(second.status).toBe(200);
    expect(second.body.receipt.messageId).toBe(messageId);
    expect(second.body.receipt.uploadToken).toBe(firstToken);

    const prisma = app.get(PrismaService);
    const count = await prisma.sosMessage.count({ where: { messageId } });
    expect(count).toBe(1);
  });

  it('dedupe does not contribute to sender rate limit even at high volume', async () => {
    const messageId = 'dedupe-test-2222-4222-8222-222222222222';
    const body = buildValidIngestRequest({ messageId });
    
    const first = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(first.status).toBe(200);

    for (let i = 0; i < 100; i++) {
      const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
      expect(response.status).toBe(200);
      expect(response.body.receipt.messageId).toBe(messageId);
    }

    const prisma = app.get(PrismaService);
    const count = await prisma.sosMessage.count({ where: { messageId } });
    expect(count).toBe(1);
  });
});
