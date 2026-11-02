import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as http from 'http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createWorkerHealthRequestListener } from '../src/worker-health.http';
import { getTestDatabaseUrl } from './helpers/database-url';

describe('Worker health HTTP (integration)', () => {
  let app: INestApplicationContext;
  let server: http.Server;

  beforeAll(async () => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
    const prisma = app.get(PrismaService);
    server = http.createServer(createWorkerHealthRequestListener(prisma));
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await app.close();
  });

  function agent() {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('worker health server not listening');
    }
    return request(`http://127.0.0.1:${address.port}`);
  }

  it('returns 200 from /health without database field', async () => {
    const response = await agent().get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.role).toBe('worker');
    expect(response.body).not.toHaveProperty('database');
  });

  it('returns 200 from /health/ready when database is up', async () => {
    const response = await agent().get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('up');
  });

  it('returns 503 from /health/ready when database probe fails', async () => {
    const prisma = app.get(PrismaService);
    const spy = jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('db down'));
    const response = await agent().get('/health/ready');
    spy.mockRestore();
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('NOT_READY');
  });
});
