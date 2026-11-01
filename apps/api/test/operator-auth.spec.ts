import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';

describe('Operator authentication', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when operator endpoint is called without auth', async () => {
    const response = await request(app.getHttpServer()).get('/v1/operator/incidents');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });
});
