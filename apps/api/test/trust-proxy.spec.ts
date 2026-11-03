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
      .send(buildValidIngestRequest({ messageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }))
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '10.2.2.2')
      .send(buildValidIngestRequest({ messageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }))
      .expect(HttpStatus.OK);

    const thirdRequest = await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '10.3.3.3')
      .send(buildValidIngestRequest({ messageId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }));

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
          relayId: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        })
      )
      .expect(HttpStatus.OK);

    const sameRealClientDifferentSpoof = await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '7.7.7.7, 203.0.113.9, 198.51.100.1')
      .send(
        buildValidIngestRequest({
          messageId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          relayId: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        })
      );

    expect(sameRealClientDifferentSpoof.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(sameRealClientDifferentSpoof.body.code).toBe('RATE_LIMIT_EXCEEDED');

    const differentRealClient = await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '6.6.6.6, 192.0.2.1, 198.51.100.1')
      .send(
        buildValidIngestRequest({
          messageId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          relayId: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        })
      );

    expect(differentRealClient.status).toBe(HttpStatus.OK);

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
          messageId: '33333333-3333-4333-8333-333333333333',
          relayId: '3333333333333333333333333333333333333333333333333333333333333333',
        })
      )
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '20.2.2.2')
      .send(
        buildValidIngestRequest({
          messageId: '44444444-4444-4444-8444-444444444444',
          relayId: '4444444444444444444444444444444444444444444444444444444444444444',
        })
      )
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .post('/v1/ingest')
      .set('X-Forwarded-For', '20.3.3.3')
      .send(
        buildValidIngestRequest({
          messageId: '55555555-5555-4555-8555-555555555555',
          relayId: '5555555555555555555555555555555555555555555555555555555555555555',
        })
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

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid TRUST_PROXY value')
    );

    delete process.env.TRUST_PROXY;
    consoleWarnSpy.mockRestore();
  });
});
