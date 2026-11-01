import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { getTestDatabaseUrl } from './helpers/database-url';
import { createTestApp } from './helpers/test-app';

describe('Request ID middleware and log redaction config (ADIM 17 deferred)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(getTestDatabaseUrl());
  });

  afterAll(async () => {
    await app.close();
  });

  it('echoes client x-request-id on responses', async () => {
    const customId = 'gate-h-req-id-7f3a2b1c';
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .set('x-request-id', customId);
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe(customId);
  });

  it('generates x-request-id when header is absent', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');
    expect(response.status).toBe(200);
    const generated = response.headers['x-request-id'];
    expect(typeof generated).toBe('string');
    expect(String(generated).length).toBeGreaterThan(8);
  });

  it('documents pino redact paths for sensitive ingest fields', () => {
    const appModulePath = join(__dirname, '..', 'src', 'app.module.ts');
    const source = readFileSync(appModulePath, 'utf8');
    expect(source).toContain('req.body.encryptedNoteBlob');
    expect(source).toContain('req.body.encryptedPayload');
    expect(source).toContain("'x-request-id': req.headers['x-request-id']");
  });
});
