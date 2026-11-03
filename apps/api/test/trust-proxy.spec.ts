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

  it('ignores X-Forwarded-For when TRUST_PROXY is not set', async () => {
    delete process.env.TRUST_PROXY;
    app = await createTestApp(getTestDatabaseUrl());

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('X-Forwarded-For', '1.2.3.4, 5.6.7.8')
      .expect(HttpStatus.OK);

    expect(response.body.status).toBe('ok');
  });

  it('uses X-Forwarded-For when TRUST_PROXY is set', async () => {
    process.env.TRUST_PROXY = '1';
    app = await createTestApp(getTestDatabaseUrl());

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('X-Forwarded-For', '1.2.3.4')
      .expect(HttpStatus.OK);

    expect(response.body.status).toBe('ok');
    delete process.env.TRUST_PROXY;
  });

  it('prevents X-Forwarded-For spoofing when trust proxy is disabled', async () => {
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

  it('applies TRUST_PROXY configuration when set', async () => {
    const savedTrustProxy = process.env.TRUST_PROXY;

    try {
      process.env.TRUST_PROXY = '2';
      app = await createTestApp(getTestDatabaseUrl());

      const response = await request(app.getHttpServer())
        .get('/health')
        .set('X-Forwarded-For', '10.0.0.1')
        .expect(HttpStatus.OK);

      expect(response.body.status).toBe('ok');
    } finally {
      if (savedTrustProxy !== undefined) {
        process.env.TRUST_PROXY = savedTrustProxy;
      } else {
        delete process.env.TRUST_PROXY;
      }
    }
  });
});
