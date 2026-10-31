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
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 50);
  });
}

class FailingMetaProvider implements MetaProvider {
  async classify() {
    return { ok: false as const, reason: 'forced_failure', retryable: false };
  }
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
