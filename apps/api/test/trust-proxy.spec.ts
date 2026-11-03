import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';

import { buildValidIngestRequest } from './helpers/build-ingest-packet';
import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';

describe('Trust proxy configuration', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('ignores X-Forwarded-For when TRUST_PROXY is unset and all requests share one rate limit bucket', async () => {
    delete process.env.TRUST_PROXY;
    process.env.INGEST_RATE_LIMIT_MAX = '2';
    process.env.INGEST_RATE_LIMIT_WINDOW_MS = '60000';

    app = await createTestApp(getTestDatabaseUrl());

    await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '10.1.1.1')
      .send(
        buildValidIngestRequest({ messageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
      )
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '10.2.2.2')
      .send(
        buildValidIngestRequest({ messageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
      )
      .expect(HttpStatus.OK);

    const thirdRequest = await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '10.3.3.3')
      .send(
        buildValidIngestRequest({ messageId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
      );

    expect(thirdRequest.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(thirdRequest.body.code).toBe('RATE_LIMIT_EXCEEDED');

    delete process.env.INGEST_RATE_LIMIT_MAX;
    delete process.env.INGEST_RATE_LIMIT_WINDOW_MS;
  });

  it('extracts real client IP from X-Forwarded-For when TRUST_PROXY=2 ignoring spoofed values', async () => {
    process.env.TRUST_PROXY = '2';
    process.env.INGEST_RATE_LIMIT_MAX = '1';
    process.env.INGEST_RATE_LIMIT_WINDOW_MS = '60000';

    app = await createTestApp(getTestDatabaseUrl());

    await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '6.6.6.6, 203.0.113.9, 198.51.100.1')
      .send(
        buildValidIngestRequest({
          messageId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          relayId:
            'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        }),
      )
      .expect(HttpStatus.OK);

    const secondRequest = await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '6.6.6.6, 203.0.113.9, 198.51.100.1')
      .send(
        buildValidIngestRequest({
          messageId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          relayId:
            'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        }),
      );

    expect(secondRequest.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(secondRequest.body.code).toBe('RATE_LIMIT_EXCEEDED');

    delete process.env.TRUST_PROXY;
    delete process.env.INGEST_RATE_LIMIT_MAX;
    delete process.env.INGEST_RATE_LIMIT_WINDOW_MS;
  });

  it('uses different rate limit buckets for different X-Forwarded-For values when TRUST_PROXY=1', async () => {
    process.env.TRUST_PROXY = '1';
    process.env.INGEST_RATE_LIMIT_MAX = '1';
    process.env.INGEST_RATE_LIMIT_WINDOW_MS = '60000';

    app = await createTestApp(getTestDatabaseUrl());

    await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '20.1.1.1')
      .send(
        buildValidIngestRequest({
          messageId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          relayId:
            'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        }),
      )
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '20.2.2.2')
      .send(
        buildValidIngestRequest({
          messageId: '11111111-1111-4111-8111-111111111111',
          relayId:
            '1111111111111111111111111111111111111111111111111111111111111111',
        }),
      )
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '20.3.3.3')
      .send(
        buildValidIngestRequest({
          messageId: '22222222-2222-4222-8222-222222222222',
          relayId:
            '2222222222222222222222222222222222222222222222222222222222222222',
        }),
      )
      .expect(HttpStatus.OK);

    delete process.env.TRUST_PROXY;
    delete process.env.INGEST_RATE_LIMIT_MAX;
    delete process.env.INGEST_RATE_LIMIT_WINDOW_MS;
  });

  it('logs warning for unparseable TRUST_PROXY values', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    process.env.TRUST_PROXY = 'invalid-value';
    app = await createTestApp(getTestDatabaseUrl());

    await request(app.getHttpServer()).get('/health').expect(HttpStatus.OK);

    delete process.env.TRUST_PROXY;
    consoleWarnSpy.mockRestore();
  });
});
