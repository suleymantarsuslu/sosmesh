import { INestApplication } from '@nestjs/common';
import {
  createPrivateKey,
  createPublicKey,
  verify,
} from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  buildValidIngestRequest,
  relayIdFromSuffix,
} from './helpers/build-ingest-packet';
import { getTestDatabaseUrl } from './helpers/database-url';
import { testIngestSigningPrivateKeyBase64 } from './helpers/ingest-test-env';
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

describe('POST /v1/ingest', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid packet and returns a verifiable SERVER_ACCEPTED receipt', async () => {
    const body = buildValidIngestRequest({
      messageId: '22222222-2222-4222-8222-222222222222',
    });
    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);

    expect(response.status).toBe(200);
    expect(response.body.receipt.ackType).toBe('SERVER_ACCEPTED');
    expect(response.body.receipt.messageId).toBe(body.sosMessage.id);
    expect(response.body.receipt.packetHash).toBe(body.transport.packetHash);
    expect(verifyReceiptSignature(response.body.receipt)).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(/ENCRYPTED_TEST/i);
  });

  it('returns the same receipt on 100 replays and keeps one sos_messages row', async () => {
    const messageId = '33333333-3333-4333-8333-333333333333';
    const body = buildValidIngestRequest({ messageId });
    let firstReceipt: Record<string, string> | undefined;

    for (let i = 0; i < 100; i += 1) {
      const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
      expect(response.status).toBe(200);
      if (!firstReceipt) {
        firstReceipt = response.body.receipt;
      } else {
        expect(response.body.receipt).toEqual(firstReceipt);
      }
    }

    const prisma = app.get(PrismaService);
    const count = await prisma.sosMessage.count({ where: { messageId } });
    expect(count).toBe(1);
    const relayCount = await prisma.relayReceipt.count({
      where: { sosMessage: { messageId } },
    });
    expect(relayCount).toBe(1);
  });

  it('stores one sos row and multiple relay receipts for different relays', async () => {
    const messageId = '44444444-4444-4444-8444-444444444444';
    const relays = ['01', '02', '03'].map((suffix) => relayIdFromSuffix(suffix));
    const baseBody = buildValidIngestRequest({ messageId });

    for (const relayId of relays) {
      const body = {
        ...baseBody,
        relayInfo: {
          ...baseBody.relayInfo,
          relayId,
        },
      };
      const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
      expect(response.status).toBe(200);
    }

    const prisma = app.get(PrismaService);
    expect(await prisma.sosMessage.count({ where: { messageId } })).toBe(1);
    expect(
      await prisma.relayReceipt.count({ where: { sosMessage: { messageId } } })
    ).toBe(3);
  });

  it('rejects malformed schema with INVALID_SOS_SCHEMA and no PII in body', async () => {
    const body = buildValidIngestRequest({
      messageId: '55555555-5555-4555-8555-555555555555',
      mutate: (message) => {
        delete message.encryptedPayload;
      },
    });
    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_SOS_SCHEMA');
    expect(JSON.stringify(response.body.message)).not.toMatch(/9334|8597|ENCRYPTED/i);
  });

  it('rejects truncated DTO with VALIDATION_ERROR', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ingest')
      .send({ sosMessage: {}, relayInfo: { relayId: 'short' } });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects tampered packet hash with PACKET_HASH_MISMATCH', async () => {
    const body = buildValidIngestRequest({
      messageId: '66666666-6666-4666-8666-666666666666',
    });
    body.transport.packetHash = `${'b'.repeat(64)}`;
    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PACKET_HASH_MISMATCH');
  });

  it('rejects oversized payload with PAYLOAD_TOO_LARGE', async () => {
    const body = buildValidIngestRequest({
      messageId: '77777777-7777-4777-8777-777777777777',
      mutate: (message) => {
        message.encryptedPayload = 'x'.repeat(70_000);
      },
    });
    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(413);
    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects unsupported protocol version', async () => {
    const body = buildValidIngestRequest({
      messageId: '88888888-8888-4888-8888-888888888888',
      mutate: (message) => {
        message.version = 99;
      },
    });
    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('UNSUPPORTED_PROTOCOL_VERSION');
  });

  it('rejects TTL-expired packets', async () => {
    const body = buildValidIngestRequest({
      messageId: '99999999-9999-4999-8999-999999999999',
      ttlSeconds: 60,
      mutate: (message) => {
        const envelope = message.envelope as Record<string, unknown>;
        envelope.timestamp = new Date(Date.now() - 120_000).toISOString();
      },
    });
    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('TTL_EXPIRED');
  });

  it('creates a single row under 20 concurrent ingests with the same message_id', async () => {
    const messageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const body = buildValidIngestRequest({ messageId });

    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 3001;
    const url = `http://127.0.0.1:${port}/v1/ingest`;

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }).then(async (res) => ({
          status: res.status,
          body: (await res.json()) as { receipt: { messageId: string } },
        }))
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body.receipt.messageId).toBe(messageId);
    }

    const prisma = app.get(PrismaService);
    expect(await prisma.sosMessage.count({ where: { messageId } })).toBe(1);
  });

  it('stores UNKNOWN envelope location without coordinates', async () => {
    const messageId = '10101010-1010-4101-8101-101010101010';
    const body = buildValidIngestRequest({
      messageId,
      envelopeProfile: 'unknown',
    });
    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(200);

    const prisma = app.get(PrismaService);
    const row = await prisma.sosMessage.findUnique({ where: { messageId } });
    expect(row?.locationStatus).toBe('UNKNOWN');
    expect(row?.latitude).toBeNull();
    expect(row?.longitude).toBeNull();
  });

  it('stores MANUAL envelope locationStatus from envelope', async () => {
    const messageId = '12121212-1212-4121-8121-121212121212';
    const body = buildValidIngestRequest({
      messageId,
      envelopeProfile: 'manual',
    });
    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(200);

    const prisma = app.get(PrismaService);
    const row = await prisma.sosMessage.findUnique({ where: { messageId } });
    expect(row?.locationStatus).toBe('MANUAL');
    expect(row?.latitude).not.toBeNull();
    expect(row?.longitude).not.toBeNull();
  });

  it('returns 409 MESSAGE_ID_CONFLICT when message_id repeats with a different packet hash', async () => {
    const messageId = '13131313-1313-4131-8131-131313131313';
    const first = buildValidIngestRequest({ messageId });
    const firstResponse = await request(app.getHttpServer()).post('/v1/ingest').send(first);
    expect(firstResponse.status).toBe(200);
    const originalHash = first.transport.packetHash;

    const conflicting = buildValidIngestRequest({
      messageId,
      mutate: (message) => {
        message.encryptedPayload = 'DIFFERENT_OPAQUE_PAYLOAD_BASE64==';
      },
    });
    const conflictResponse = await request(app.getHttpServer())
      .post('/v1/ingest')
      .send(conflicting);

    expect(conflictResponse.status).toBe(409);
    expect(conflictResponse.body.code).toBe('MESSAGE_ID_CONFLICT');
    expect(JSON.stringify(conflictResponse.body.message)).not.toMatch(/9334|ENCRYPTED/i);

    const prisma = app.get(PrismaService);
    expect(await prisma.sosMessage.count({ where: { messageId } })).toBe(1);
    const row = await prisma.sosMessage.findUnique({ where: { messageId } });
    expect(row?.packetHash).toBe(originalHash);
    expect(row?.needsHumanReview).toBe(true);
  });

  it('fails verification when receipt signature is corrupted', async () => {
    const body = buildValidIngestRequest({
      messageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    const receipt = { ...response.body.receipt, signature: 'AAAA' };
    expect(verifyReceiptSignature(receipt)).toBe(false);
  });
});

describe('POST /v1/ingest envelope privacy', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects envelope plaintext-like fields and does not persist a new message', async () => {
    const messageId = 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1';
    const beforeCount = await prisma.sosMessage.count();
    const body = buildValidIngestRequest({
      messageId,
      mutate: (message) => {
        (message.envelope as Record<string, unknown>).plaintextForOperator = 'secret sos text';
      },
    });

    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('ENVELOPE_SENSITIVE_FIELD');
    expect(JSON.stringify(response.body)).not.toMatch(/secret sos text/i);

    const afterCount = await prisma.sosMessage.count();
    expect(afterCount).toBe(beforeCount);
    const stored = await prisma.sosMessage.findUnique({ where: { messageId } });
    expect(stored).toBeNull();
  });

  it('rejects array envelope so forbidden-field scan cannot be skipped', async () => {
    const messageId = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2';
    const beforeCount = await prisma.sosMessage.count();
    const body = buildValidIngestRequest({
      messageId,
      mutate: (message) => {
        message.envelope = [{ note: 'array envelope' }] as unknown as Record<string, unknown>;
      },
    });

    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_ENVELOPE');

    const afterCount = await prisma.sosMessage.count();
    expect(afterCount).toBe(beforeCount);
  });
});

describe('POST /v1/ingest rate limit', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.INGEST_RATE_LIMIT_MAX = '2';
    process.env.INGEST_RATE_LIMIT_WINDOW_MS = '60000';
    app = await createTestApp(getTestDatabaseUrl());
  });

  afterAll(async () => {
    delete process.env.INGEST_RATE_LIMIT_MAX;
    await app.close();
  });

  it('returns 429 when ingest rate limit is exceeded', async () => {
    const first = buildValidIngestRequest({
      messageId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    const second = buildValidIngestRequest({
      messageId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });
    const third = buildValidIngestRequest({
      messageId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    });

    expect((await request(app.getHttpServer()).post('/v1/ingest').send(first)).status).toBe(
      200
    );
    expect((await request(app.getHttpServer()).post('/v1/ingest').send(second)).status).toBe(
      200
    );
    const limited = await request(app.getHttpServer()).post('/v1/ingest').send(third);
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
