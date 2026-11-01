import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { OperatorFeedService } from '../src/events/operator-feed.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildValidIngestRequest } from './helpers/build-ingest-packet';
import { getTestDatabaseUrl } from './helpers/database-url';
import { operatorBearerToken } from './helpers/operator-auth';
import { createTestApp } from './helpers/test-app';

describe('operator feed first-accept transaction', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rolls back SOS row when feed insert fails; retry creates one SOS and one feed event', async () => {
    const messageId = randomUUID();
    const body = buildValidIngestRequest({ messageId });
    const original = OperatorFeedService.prototype.insertFirstAcceptInTransaction;
    const insertSpy = jest
      .spyOn(OperatorFeedService.prototype, 'insertFirstAcceptInTransaction')
      .mockImplementationOnce(async () => {
        throw new Error('simulated operator feed insert failure');
      })
      .mockImplementation(original);

    try {
      const failed = await request(app.getHttpServer()).post('/v1/ingest').send(body);
      expect(failed.status).toBeGreaterThanOrEqual(500);

      expect(await prisma.sosMessage.count({ where: { messageId } })).toBe(0);
      expect(await prisma.operatorFeedEvent.count({ where: { messageId } })).toBe(0);

      const retry = await request(app.getHttpServer()).post('/v1/ingest').send(body);
      expect(retry.status).toBe(200);

      expect(await prisma.sosMessage.count({ where: { messageId } })).toBe(1);
      expect(await prisma.operatorFeedEvent.count({ where: { messageId } })).toBe(1);
    } finally {
      insertSpy.mockRestore();
    }
  });

  it('20 concurrent ingests with incremental after=cursor polling yields 20 unique feed events', async () => {
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 3001;
    const baseUrl = `http://127.0.0.1:${port}`;
    const token = operatorBearerToken();
    const authHeader = { Authorization: `Bearer ${token}` };

    const baseline = await fetch(`${baseUrl}/v1/operator/events?after=0`, {
      headers: authHeader,
    });
    expect(baseline.status).toBe(200);
    const baselineBody = (await baseline.json()) as {
      events: { id: string; messageId: string }[];
    };
    let cursor =
      baselineBody.events.length > 0
        ? baselineBody.events[baselineBody.events.length - 1].id
        : '0';

    const messageIds = Array.from({ length: 20 }, () => randomUUID());
    const targetIds = new Set<string>(messageIds);
    const seenEventIds = new Set<string>();
    const seenTargetMessageIds = new Set<string>();

    const pollAfterCursor = async (): Promise<void> => {
      const feed = await fetch(`${baseUrl}/v1/operator/events?after=${cursor}`, {
        headers: authHeader,
      });
      expect(feed.status).toBe(200);
      const body = (await feed.json()) as {
        events: { id: string; messageId: string }[];
      };
      for (const event of body.events) {
        expect(seenEventIds.has(event.id)).toBe(false);
        seenEventIds.add(event.id);
        if (targetIds.has(event.messageId)) {
          seenTargetMessageIds.add(event.messageId);
        }
        cursor = event.id;
      }
    };

    const polling = (async () => {
      while (seenTargetMessageIds.size < 20) {
        await pollAfterCursor();
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    })();

    await Promise.all([
      polling,
      ...messageIds.map(async (messageId) => {
        const ingest = await fetch(`${baseUrl}/v1/ingest`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildValidIngestRequest({ messageId })),
        });
        expect(ingest.status).toBe(200);
      }),
    ]);

    for (let round = 0; round < 5; round += 1) {
      await pollAfterCursor();
    }

    expect(seenTargetMessageIds.size).toBe(20);

    const rows = await prisma.operatorFeedEvent.findMany({
      where: { messageId: { in: messageIds } },
      orderBy: { seq: 'asc' },
    });
    expect(rows).toHaveLength(20);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].seq).toBeGreaterThan(rows[i - 1].seq);
    }
  });
});
