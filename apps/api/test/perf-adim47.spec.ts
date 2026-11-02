import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { buildValidIngestRequest } from './helpers/build-ingest-packet';
import { getTestDatabaseUrl } from './helpers/database-url';
import { operatorBearerToken, applyTestAuthEnv } from './helpers/operator-auth';
import { createTestApp } from './helpers/test-app';

type ExplainRow = { 'QUERY PLAN': string };

describe('ADIM 47 — perf indexes and DB profile', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('defines sos_messages list indexes for operator pagination', async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'sos_messages'
        AND indexname IN (
          'sos_messages_priority_received_at_idx',
          'sos_messages_received_at_idx'
        )
    `;
    const names = rows.map((row) => row.indexname).sort();
    expect(names).toEqual([
      'sos_messages_priority_received_at_idx',
      'sos_messages_received_at_idx',
    ]);
  });

  it('EXPLAIN operator case list uses priority/received_at index at seeded volume', async () => {
    const seedCount = 120;
    for (let i = 0; i < seedCount; i += 1) {
      const body = buildValidIngestRequest({ messageId: randomUUID() });
      const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
      expect(response.status).toBe(200);
    }

    await prisma.$executeRawUnsafe('ANALYZE sos_messages');

    const planRows = await prisma.$queryRaw<ExplainRow[]>`
      EXPLAIN
      SELECT id, priority, received_at
      FROM sos_messages
      ORDER BY priority ASC, received_at DESC
      LIMIT 51
    `;
    const planText = planRows.map((row) => row['QUERY PLAN']).join('\n');
    expect(planText).toContain('sos_messages_priority_received_at_idx');
  });

  it('documents read-replica non-requirement: feed poll stays index-backed on primary', async () => {
    for (let i = 0; i < 80; i += 1) {
      const body = buildValidIngestRequest({ messageId: randomUUID() });
      const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
      expect(response.status).toBe(200);
    }

    await prisma.$executeRawUnsafe('ANALYZE operator_feed_events');

    const planRows = await prisma.$queryRaw<ExplainRow[]>`
      EXPLAIN
      SELECT seq, message_id, incident_id
      FROM operator_feed_events
      WHERE seq > 0
      ORDER BY seq ASC
      LIMIT 100
    `;
    const planText = planRows.map((row) => row['QUERY PLAN']).join('\n');
    expect(planText).toContain('operator_feed_events_seq_idx');
  });
});

describe('ADIM 47 — resilience (SSE cursor, restart, backpressure, AI off)', () => {
  it('preserves operator feed cursor across API process restart', async () => {
    delete process.env.JWT_SECRET;
    applyTestAuthEnv();
    const dbUrl = getTestDatabaseUrl();
    const app1 = await createTestApp(dbUrl);
    const prisma1 = app1.get(PrismaService);
    const beforeMax = await prisma1.operatorFeedEvent.aggregate({ _max: { seq: true } });
    const beforeSeq = beforeMax._max.seq ?? 0n;

    const messageId = randomUUID();
    const ingest = await request(app1.getHttpServer())
      .post('/v1/ingest')
      .send(buildValidIngestRequest({ messageId }));
    expect(ingest.status).toBe(200);

    const feedRow = await prisma1.operatorFeedEvent.findFirst({
      where: { messageId },
      select: { seq: true },
    });
    expect(feedRow).not.toBeNull();
    const lastId = feedRow!.seq.toString();

    const token = operatorBearerToken();
    await app1.close();

    const app2 = await createTestApp(dbUrl);
    const incremental = await request(app2.getHttpServer())
      .get(`/v1/operator/events?after=${lastId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(incremental.status).toBe(200);
    expect(incremental.body.events).toHaveLength(0);

    const reconnect = await request(app2.getHttpServer())
      .get(`/v1/operator/events?after=${beforeSeq.toString()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(reconnect.status).toBe(200);
    const matches = reconnect.body.events.filter(
      (event: { messageId: string }) => event.messageId === messageId
    );
    expect(matches).toHaveLength(1);
    await app2.close();
  });

  it('returns 429 ingest backpressure when per-client rate limit is exceeded', async () => {
    const dbUrl = getTestDatabaseUrl();
    process.env.INGEST_RATE_LIMIT_MAX = '3';
    process.env.INGEST_RATE_LIMIT_WINDOW_MS = '60000';
    const limitedApp = await createTestApp(dbUrl);
    try {
      let throttled = 0;
      for (let i = 0; i < 6; i += 1) {
        const response = await request(limitedApp.getHttpServer())
          .post('/v1/ingest')
          .send(buildValidIngestRequest({ messageId: randomUUID() }));
        if (response.status === 429) {
          throttled += 1;
        }
      }
      expect(throttled).toBeGreaterThan(0);
    } finally {
      delete process.env.INGEST_RATE_LIMIT_MAX;
      delete process.env.INGEST_RATE_LIMIT_WINDOW_MS;
      await limitedApp.close();
    }
  });

  it('keeps ingest 200 when AI is disabled (graceful degradation)', async () => {
    const dbUrl = getTestDatabaseUrl();
    process.env.AI_ENABLED = 'false';
    const localApp = await createTestApp(dbUrl);
    try {
      const response = await request(localApp.getHttpServer())
        .post('/v1/ingest')
        .send(buildValidIngestRequest({ messageId: randomUUID() }));
      expect(response.status).toBe(200);
      expect(response.body.receipt.ackType).toBe('SERVER_ACCEPTED');
    } finally {
      delete process.env.AI_ENABLED;
      await localApp.close();
    }
  });
});

describe('ADIM 47 — measured ingest latency sample (local embedded PG)', () => {
  it('records p50/p95 for 100 sequential synthetic ingests', async () => {
    const app = await createTestApp(getTestDatabaseUrl());
    const durationsMs: number[] = [];
    try {
      for (let i = 0; i < 100; i += 1) {
        const started = performance.now();
        const response = await request(app.getHttpServer())
          .post('/v1/ingest')
          .send(buildValidIngestRequest({ messageId: randomUUID() }));
        durationsMs.push(performance.now() - started);
        expect(response.status).toBe(200);
      }
    } finally {
      await app.close();
    }

    durationsMs.sort((a, b) => a - b);
    const p50 = durationsMs[Math.floor(durationsMs.length * 0.5)];
    const p95 = durationsMs[Math.floor(durationsMs.length * 0.95)];
    expect(p50).toBeGreaterThan(0);
    expect(p95).toBeGreaterThanOrEqual(p50);
    // Persist sample for perf-report regeneration (no secrets).
    process.stdout.write(
      `ADIM47_JEST_LATENCY_SAMPLE p50_ms=${p50.toFixed(2)} p95_ms=${p95.toFixed(2)}\n`
    );
  });
});
