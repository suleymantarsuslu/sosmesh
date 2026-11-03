import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { getTestDatabaseUrl } from './helpers/database-url';
import { applyTestAuthEnv } from './helpers/operator-auth';
import { applyTestIngestEnv } from './helpers/ingest-test-env';

describe('AppModule DI smoke test', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    applyTestAuthEnv();
    applyTestIngestEnv();
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
  });

  it('compiles AppModule with AI_ENABLED=true', async () => {
    process.env.AI_ENABLED = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('compiles AppModule with AI_ENABLED=false', async () => {
    process.env.AI_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
