import { INestApplication } from '@nestjs/common';
import {
  createPrivateKey,
  createPublicKey,
  verify,
} from 'node:crypto';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  buildValidIngestRequest,
  relayIdFromSuffix,
} from './helpers/build-ingest-packet';
import { getTestDatabaseUrl } from './helpers/database-url';
import { testIngestSigningPrivateKeyBase64 } from './helpers/ingest-test-env';
import { operatorBearerToken } from './helpers/operator-auth';
import { createTestApp } from './helpers/test-app';

function verifyReceiptSignature(receipt: {
  ackType: string;
  messageId: string;
  packetHash: string;
  timestamp: string;
  signature: string;
}): boolean {
  const privateKey = createPrivateKey({
    key: Buffer.from(testIngestSigningPrivateKeyBase64(), 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const publicKey = createPublicKey(privateKey);
  const payload = Buffer.from(
    `${receipt.ackType}|${receipt.messageId}|${receipt.packetHash}|${receipt.timestamp}`,
    'utf8'
  );
  return verify(
    null,
    payload,
    publicKey,
    Buffer.from(receipt.signature, 'base64')
  );
}

describe('POST /v1/ingest/batch', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
  });

  afterAll(async () => {
    await app.close();
  });

  it('deduplicates duplicate items in one batch to a single sos_messages row', async () => {
    const messageId = randomUUID();
    const body = buildValidIngestRequest({ messageId });
    const response = await request(app.getHttpServer())
      .post('/v1/ingest/batch')
      .send({ items: [body, body] });

    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(2);
    expect(response.body.results[0].status).toBe('accepted');
    expect(response.body.results[1].status).toBe('accepted');
    expect(verifyReceiptSignature(response.body.results[0].receipt)).toBe(true);
    expect(response.body.results[0].receipt).toEqual(response.body.results[1].receipt);

    const prisma = app.get(PrismaService);
    const count = await prisma.sosMessage.count({ where: { messageId } });
    expect(count).toBe(1);
  });
});

describe('GET /v1/operator/events', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without operator token', async () => {
    const response = await request(app.getHttpServer()).get('/v1/operator/events');
    expect(response.status).toBe(401);
  });

  it('emits one feed event when the same SOS arrives from three relays', async () => {
    const messageId = randomUUID();
    const base = buildValidIngestRequest({ messageId });
    const relays = ['01', '02', '03'].map((suffix) => ({
      ...base,
      relayInfo: {
        ...base.relayInfo,
        relayId: relayIdFromSuffix(suffix),
        relayTimestamp: new Date().toISOString(),
      },
    }));

    for (const item of relays) {
      const ingest = await request(app.getHttpServer()).post('/v1/ingest').send(item);
      expect(ingest.status).toBe(200);
    }

    const token = operatorBearerToken();
    const feed = await request(app.getHttpServer())
      .get('/v1/operator/events')
      .set('Authorization', `Bearer ${token}`);

    expect(feed.status).toBe(200);
    const matches = feed.body.events.filter(
      (event: { messageId: string }) => event.messageId === messageId
    );
    expect(matches).toHaveLength(1);
    expect(JSON.stringify(feed.body)).not.toMatch(/ENCRYPTED_TEST/i);
  });

  it('replays missed events in order after Last-Event-ID reconnect without duplicates', async () => {
    const token = operatorBearerToken();
    const first = await request(app.getHttpServer())
      .get('/v1/operator/events')
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    const baseline = first.body.events.length;

    const messageId = randomUUID();
    const ingest = await request(app.getHttpServer())
      .post('/v1/ingest')
      .send(buildValidIngestRequest({ messageId }));
    expect(ingest.status).toBe(200);

    const snapshot = await request(app.getHttpServer())
      .get('/v1/operator/events')
      .set('Authorization', `Bearer ${token}`);
    expect(snapshot.body.events.length).toBeGreaterThan(baseline);
    const lastId = snapshot.body.events[snapshot.body.events.length - 1].id;

    const replay = await request(app.getHttpServer())
      .get(`/v1/operator/events?after=${lastId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(replay.status).toBe(200);
    expect(replay.body.events).toHaveLength(0);

    const reconnect = await request(app.getHttpServer())
      .get('/v1/operator/events?after=0')
      .set('Authorization', `Bearer ${token}`)
      .set('Last-Event-ID', '0');
    const ids = reconnect.body.events.map((event: { id: string }) => event.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    for (let i = 1; i < ids.length; i += 1) {
      expect(BigInt(ids[i])).toBeGreaterThan(BigInt(ids[i - 1]));
    }
  });
});
