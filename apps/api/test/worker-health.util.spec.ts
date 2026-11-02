import { PrismaService } from '../src/prisma/prisma.service';
import { workerLivenessBody, workerReadiness } from '../src/worker-health.util';

describe('worker-health.util', () => {
  it('returns liveness payload without database fields', () => {
    const body = workerLivenessBody();
    expect(body.status).toBe('ok');
    expect(body.role).toBe('worker');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body).not.toHaveProperty('database');
  });

  it('reports readiness up when database probe succeeds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;

    const result = await workerReadiness(prisma);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.database).toBe('up');
      expect(result.body.status).toBe('ok');
    }
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('reports readiness down when database probe fails', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as PrismaService;

    const result = await workerReadiness(prisma);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body.code).toBe('NOT_READY');
      expect(result.body.message).toBe('Database unavailable');
    }
  });
});
