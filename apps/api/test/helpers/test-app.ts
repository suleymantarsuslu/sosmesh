import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';

import { AppModule } from '../../src/app.module';
import { securityHeadersMiddleware } from '../../src/common/middleware/security-headers.middleware';
import { applyTrustProxy } from '../../src/common/utils/trust-proxy.util';
import { applyTestAuthEnv } from './operator-auth';
import { applyTestIngestEnv } from './ingest-test-env';

export async function createTestApp(databaseUrl: string): Promise<INestApplication> {
  process.env.DATABASE_URL = databaseUrl;
  applyTestAuthEnv();
  applyTestIngestEnv();
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({ bufferLogs: true });
  app.use(cookieParser());
  app.use(securityHeadersMiddleware);
  applyTrustProxy(app, process.env.TRUST_PROXY);
  await app.init();
  return app;
}
