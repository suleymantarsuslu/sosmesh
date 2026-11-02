import { envValidationSchema } from '../src/config/env.schema';
import { applyTestAuthEnv } from './helpers/operator-auth';
import { applyTestIngestEnv } from './helpers/ingest-test-env';

describe('Env validation boot (ADIM 17 deferred)', () => {
  it('rejects configuration when DATABASE_URL is missing', () => {
    applyTestAuthEnv();
    applyTestIngestEnv();
    const { error } = envValidationSchema.validate(
      {
        NODE_ENV: 'test',
        JWT_SECRET: process.env.JWT_SECRET,
        INGEST_RECEIPT_SIGNING_PRIVATE_KEY: process.env.INGEST_RECEIPT_SIGNING_PRIVATE_KEY,
      },
      { abortEarly: true, allowUnknown: true }
    );
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/DATABASE_URL/i);
  });

  it('accepts configuration when required env vars are present', () => {
    applyTestAuthEnv();
    applyTestIngestEnv();
    const { error, value } = envValidationSchema.validate(
      {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/sosmesh_test',
        JWT_SECRET: process.env.JWT_SECRET,
        METRICS_SCRAPE_AUTH: process.env.METRICS_SCRAPE_AUTH,
        INGEST_RECEIPT_SIGNING_PRIVATE_KEY: process.env.INGEST_RECEIPT_SIGNING_PRIVATE_KEY,
      },
      { abortEarly: true, allowUnknown: true }
    );
    expect(error).toBeUndefined();
    expect(value.DATABASE_URL).toContain('postgresql://');
  });
});
