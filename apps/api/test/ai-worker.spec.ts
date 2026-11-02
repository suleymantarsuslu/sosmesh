import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AI_PROVIDER_OVERRIDE, AiJobService } from '../src/ai/ai-job.service';
import { AI_ANALYSIS_STATUS } from '../src/ai/ai.constants';
import { AiCostGuard, TenantAiRateLimiter } from '../src/ai/ai-guards';
import { buildMockMetaProvider } from '../src/ai/providers/meta';
import { EVAL_FIXTURES } from '../src/ai/evals/fixtures';
import type { MetaProvider } from '../src/ai/providers/meta';
import { SOS_PLAINTEXT_SOURCE } from '../src/ai/sos-plaintext-source';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildValidIngestRequest } from './helpers/build-ingest-packet';
import { getTestDatabaseUrl } from './helpers/database-url';
import { FakeSosPlaintextSource } from './helpers/fake-plaintext-source';
import { applyTestIngestEnv } from './helpers/ingest-test-env';
import { applyTestAuthEnv } from './helpers/operator-auth';
import { createTestApp } from './helpers/test-app';

async function flushAiJobs(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 200);
  });
}

async function waitForAiAnalysis(
  prisma: PrismaService,
  incidentId: string | null | undefined,
  timeoutMs = 10_000
) {
  if (!incidentId) {
    return null;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const analysis = await prisma.aiAnalysis.findFirst({ where: { incidentId } });
    if (analysis) {
      return analysis;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
  }
  return null;
}

class FailingMetaProvider implements MetaProvider {
  async classify() {
    return { ok: false as const, reason: 'forced_failure', retryable: false };
  }
}

class InvalidSchemaMetaProvider implements MetaProvider {
  async classify() {
    return { ok: false as const, reason: 'invalid_model_json', retryable: false };
  }
}

async function createIngestTestApp(params: {
  messageId: string;
  plaintext: string;
  provider: MetaProvider;
  env?: Record<string, string | undefined>;
}): Promise<INestApplication & { restoreEnv: () => void }> {
  const envSnapshot: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params.env ?? {})) {
    envSnapshot[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  process.env.DATABASE_URL = getTestDatabaseUrl();
  applyTestAuthEnv();
  applyTestIngestEnv();
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  if (params.env?.AI_ENABLED === undefined) {
    process.env.AI_ENABLED = 'true';
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AI_PROVIDER_OVERRIDE)
    .useValue(params.provider)
    .overrideProvider(SOS_PLAINTEXT_SOURCE)
    .useValue(
      new FakeSosPlaintextSource({
        [params.messageId]: params.plaintext,
      })
    )
    .compile();

  const localApp = moduleRef.createNestApplication({ bufferLogs: true });
  await localApp.init();

  return Object.assign(localApp, {
    restoreEnv: () => {
      for (const [key, value] of Object.entries(envSnapshot)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    },
  });
}

describe('AI worker (async, post-ingest)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps POST /v1/ingest 200 when AI fails', async () => {
    const messageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_PROVIDER_OVERRIDE)
      .useValue(new FailingMetaProvider())
      .overrideProvider(SOS_PLAINTEXT_SOURCE)
      .useValue(
        new FakeSosPlaintextSource({
          [messageId]: 'deprem oldu binamız yıkıldı 3 kişi enkaz altında case-tr-01',
        })
      )
      .compile();

    process.env.DATABASE_URL = getTestDatabaseUrl();
    applyTestAuthEnv();
    applyTestIngestEnv();
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.AI_ENABLED = 'true';

    const failingApp = moduleRef.createNestApplication({ bufferLogs: true });
    await failingApp.init();

    const body = buildValidIngestRequest({ messageId });

    const response = await request(failingApp.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(200);
    await flushAiJobs();

    const message = await failingApp.get(PrismaService).sosMessage.findUnique({
      where: { messageId: String(body.sosMessage.id) },
    });
    expect(message).not.toBeNull();
    const analysis = await failingApp.get(PrismaService).aiAnalysis.findFirst({
      where: { incidentId: message?.incidentId },
    });
    expect(analysis?.status).toBe(AI_ANALYSIS_STATUS.FAILED);

    await failingApp.close();
  });

  it('skips AI with NO_PLAINTEXT when only encrypted payload exists', async () => {
    const body = buildValidIngestRequest({
      messageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    });

    const response = await request(app.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(200);
    await flushAiJobs();

    const message = await prisma.sosMessage.findUnique({
      where: { messageId: String(body.sosMessage.id) },
    });
    const analysis = await prisma.aiAnalysis.findFirst({
      where: { incidentId: message?.incidentId },
    });
    expect(analysis?.status).toBe(AI_ANALYSIS_STATUS.NO_PLAINTEXT);
  });

  it('persists COMPLETED analysis when server plaintext source returns fixture text', async () => {
    const messageId = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_PROVIDER_OVERRIDE)
      .useValue(buildMockMetaProvider(EVAL_FIXTURES))
      .overrideProvider(SOS_PLAINTEXT_SOURCE)
      .useValue(
        new FakeSosPlaintextSource({
          [messageId]: 'earthquake building collapsed need rescue case-en-01',
        })
      )
      .compile();

    process.env.DATABASE_URL = getTestDatabaseUrl();
    applyTestAuthEnv();
    applyTestIngestEnv();
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.AI_ENABLED = 'true';

    const localApp = moduleRef.createNestApplication({ bufferLogs: true });
    await localApp.init();

    const body = buildValidIngestRequest({ messageId });
    const response = await request(localApp.getHttpServer()).post('/v1/ingest').send(body);
    expect(response.status).toBe(200);
    await flushAiJobs();

    const message = await localApp.get(PrismaService).sosMessage.findUnique({
      where: { messageId: String(body.sosMessage.id) },
    });
    const analysis = await localApp.get(PrismaService).aiAnalysis.findFirst({
      where: { incidentId: message?.incidentId },
    });
    expect(analysis?.status).toBe(AI_ANALYSIS_STATUS.COMPLETED);
    expect(analysis?.resultJson).toMatchObject({ requires_human_review: true });
    await localApp.close();
  });

  it('respects tenant rate limit guard', async () => {
    const limiter = new TenantAiRateLimiter(1, 60000);
    expect(limiter.tryConsume('tenant-a')).toBe(true);
    expect(limiter.tryConsume('tenant-a')).toBe(false);
    expect(limiter.tryConsume('tenant-b')).toBe(true);
  });

  it('respects daily cost cap guard', async () => {
    const guard = new AiCostGuard(0.001);
    expect(guard.tryCharge(0.001)).toBe(true);
    expect(guard.tryCharge(0.001)).toBe(false);
  });

  it('resets AiCostGuard spend at UTC day boundary', () => {
    const guard = new AiCostGuard(1);
    const endOfDay = Date.parse('2026-11-01T23:59:00.000Z');
    expect(guard.tryCharge(0.9, endOfDay)).toBe(true);
    expect(guard.tryCharge(0.2, endOfDay)).toBe(false);
    const nextUtcDay = Date.parse('2026-11-02T00:00:00.000Z');
    expect(guard.tryCharge(0.9, nextUtcDay)).toBe(true);
  });

  it('skips provider call when AI is disabled', async () => {
    const previous = process.env.AI_ENABLED;
    process.env.AI_ENABLED = 'false';
    const job = app.get(AiJobService);
    const incident = await prisma.incident.create({ data: {} });
    await job.runJob({
      incidentId: incident.id,
      messageId: 'disabled-msg-id',
      tenantKey: 'disabled-test',
    });
    const analysis = await prisma.aiAnalysis.findFirst({ where: { incidentId: incident.id } });
    expect(analysis?.status).toBe(AI_ANALYSIS_STATUS.SKIPPED_DISABLED);
    process.env.AI_ENABLED = previous;
  });

  it('keeps ingest 200 when AI is disabled', async () => {
    const messageId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5';
    const localApp = await createIngestTestApp({
      messageId,
      plaintext: 'deprem oldu case-tr-01',
      provider: buildMockMetaProvider(EVAL_FIXTURES),
      env: { AI_ENABLED: 'false' },
    });
    try {
      const body = buildValidIngestRequest({ messageId });
      const response = await request(localApp.getHttpServer()).post('/v1/ingest').send(body);
      expect(response.status).toBe(200);
      await flushAiJobs();
      const message = await localApp.get(PrismaService).sosMessage.findUnique({
        where: { messageId: String(body.sosMessage.id) },
      });
      const analysis = await localApp.get(PrismaService).aiAnalysis.findFirst({
        where: { incidentId: message?.incidentId },
      });
      expect(analysis?.status).toBe(AI_ANALYSIS_STATUS.SKIPPED_DISABLED);
    } finally {
      localApp.restoreEnv();
      await localApp.close();
    }
  });

  it('keeps ingest 200 when daily AI cost cap blocks classification', async () => {
    const messageId = 'ffffffff-ffff-4fff-8fff-fffffffffff6';
    const localApp = await createIngestTestApp({
      messageId,
      plaintext: 'earthquake building collapsed case-en-01',
      provider: buildMockMetaProvider(EVAL_FIXTURES),
      env: {
        AI_DAILY_COST_CAP_USD: '0.001',
        AI_ESTIMATED_COST_USD: '0.002',
      },
    });
    try {
      const body = buildValidIngestRequest({ messageId });
      const response = await request(localApp.getHttpServer()).post('/v1/ingest').send(body);
      expect(response.status).toBe(200);
      await flushAiJobs();
      const message = await localApp.get(PrismaService).sosMessage.findUnique({
        where: { messageId: String(body.sosMessage.id) },
      });
      expect(message?.incidentId).toBeDefined();
      const analysis = await waitForAiAnalysis(
        localApp.get(PrismaService),
        message?.incidentId
      );
      expect(analysis?.status).toBe(AI_ANALYSIS_STATUS.SKIPPED_COST_CAP);
    } finally {
      localApp.restoreEnv();
      await localApp.close();
    }
  });

  it('keeps ingest 200 when tenant AI rate limit is exceeded', async () => {
    const firstMessageId = '11111111-1111-4111-8111-111111111117';
    const secondMessageId = '22222222-2222-4222-8222-222222222228';
    process.env.DATABASE_URL = getTestDatabaseUrl();
    applyTestAuthEnv();
    applyTestIngestEnv();
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.AI_ENABLED = 'true';
    process.env.AI_TENANT_RATE_LIMIT_MAX = '1';
    process.env.AI_TENANT_RATE_LIMIT_WINDOW_MS = '60000';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_PROVIDER_OVERRIDE)
      .useValue(buildMockMetaProvider(EVAL_FIXTURES))
      .overrideProvider(SOS_PLAINTEXT_SOURCE)
      .useValue(
        new FakeSosPlaintextSource({
          [firstMessageId]: 'deprem enkaz altında case-tr-02',
          [secondMessageId]: 'fire smoke inhalation case-en-03',
        })
      )
      .compile();

    const localApp = moduleRef.createNestApplication({ bufferLogs: true });
    await localApp.init();
    try {
      const firstBody = buildValidIngestRequest({ messageId: firstMessageId });
      const first = await request(localApp.getHttpServer()).post('/v1/ingest').send(firstBody);
      expect(first.status).toBe(200);
      await flushAiJobs();

      const secondBody = buildValidIngestRequest({ messageId: secondMessageId });
      const second = await request(localApp.getHttpServer()).post('/v1/ingest').send(secondBody);
      expect(second.status).toBe(200);
      await flushAiJobs();

      const secondMessage = await localApp.get(PrismaService).sosMessage.findUnique({
        where: { messageId: String(secondBody.sosMessage.id) },
      });
      const analysis = await localApp.get(PrismaService).aiAnalysis.findFirst({
        where: { incidentId: secondMessage?.incidentId },
      });
      expect(analysis?.status).toBe(AI_ANALYSIS_STATUS.SKIPPED_RATE_LIMIT);
    } finally {
      delete process.env.AI_TENANT_RATE_LIMIT_MAX;
      delete process.env.AI_TENANT_RATE_LIMIT_WINDOW_MS;
      await localApp.close();
    }
  });

  it('skips second classify on same incident when token budget is exhausted', async () => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    applyTestAuthEnv();
    applyTestIngestEnv();
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.AI_ENABLED = 'true';
    process.env.AI_INCIDENT_TOKEN_BUDGET = '2048';
    process.env.AI_ESTIMATED_TOKENS_PER_CLASSIFY = '2048';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_PROVIDER_OVERRIDE)
      .useValue(buildMockMetaProvider(EVAL_FIXTURES))
      .overrideProvider(SOS_PLAINTEXT_SOURCE)
      .useValue(
        new FakeSosPlaintextSource({
          'token-msg-a': 'earthquake need help case-en-04',
          'token-msg-b': 'fire trapped upstairs case-en-05',
        })
      )
      .compile();

    const localApp = moduleRef.createNestApplication({ bufferLogs: true });
    await localApp.init();
    const localPrisma = localApp.get(PrismaService);
    const job = localApp.get(AiJobService);
    const incident = await localPrisma.incident.create({ data: {} });

    await job.runJob({
      incidentId: incident.id,
      messageId: 'token-msg-a',
      tenantKey: 'token-budget-a',
    });
    await job.runJob({
      incidentId: incident.id,
      messageId: 'token-msg-b',
      tenantKey: 'token-budget-b',
    });

    const analyses = await localPrisma.aiAnalysis.findMany({
      where: { incidentId: incident.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(analyses).toHaveLength(2);
    expect(analyses[0]?.status).toBe(AI_ANALYSIS_STATUS.COMPLETED);
    expect(analyses[1]?.status).toBe(AI_ANALYSIS_STATUS.SKIPPED_INCIDENT_TOKEN_BUDGET);
    await localApp.close();
  });

  it('keeps ingest 200 and applies safe fallback on schema-invalid model output', async () => {
    const messageId = '33333333-3333-4333-8333-333333333339';
    const localApp = await createIngestTestApp({
      messageId,
      plaintext: 'help unknown injuries case-en-06',
      provider: new InvalidSchemaMetaProvider(),
    });
    try {
      const body = buildValidIngestRequest({ messageId });
      const response = await request(localApp.getHttpServer()).post('/v1/ingest').send(body);
      expect(response.status).toBe(200);
      await flushAiJobs();
      const message = await localApp.get(PrismaService).sosMessage.findUnique({
        where: { messageId: String(body.sosMessage.id) },
      });
      const analysis = await localApp.get(PrismaService).aiAnalysis.findFirst({
        where: { incidentId: message?.incidentId },
      });
      expect(analysis?.status).toBe(AI_ANALYSIS_STATUS.COMPLETED_FALLBACK);
      expect(analysis?.resultJson).toMatchObject({
        fallback_applied: true,
        persons_estimate: null,
        location_unknown: true,
        urgency_suggestion: 'unknown',
      });
    } finally {
      localApp.restoreEnv();
      await localApp.close();
    }
  });

  it('uses mock provider override for deterministic classification', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_PROVIDER_OVERRIDE)
      .useValue(buildMockMetaProvider(EVAL_FIXTURES))
      .overrideProvider(SOS_PLAINTEXT_SOURCE)
      .useValue(
        new FakeSosPlaintextSource({
          'fixture-msg-02': 'two injured bleeding heavily case-en-02',
        })
      )
      .compile();

    process.env.DATABASE_URL = getTestDatabaseUrl();
    applyTestAuthEnv();
    applyTestIngestEnv();
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.AI_ENABLED = 'true';

    const localApp = moduleRef.createNestApplication({ bufferLogs: true });
    await localApp.init();
    const localPrisma = localApp.get(PrismaService);
    const job = localApp.get(AiJobService);
    const incident = await localPrisma.incident.create({ data: {} });
    await job.runJob({
      incidentId: incident.id,
      messageId: 'fixture-msg-02',
      tenantKey: 'mock',
    });
    const analysis = await localPrisma.aiAnalysis.findFirst({ where: { incidentId: incident.id } });
    expect(analysis?.status).toBe(AI_ANALYSIS_STATUS.COMPLETED);
    await localApp.close();
  });
});
