import { PrismaService } from './prisma/prisma.service';

export function workerLivenessBody(): Record<string, string> {
  return {
    status: 'ok',
    role: 'worker',
    timestamp: new Date().toISOString(),
  };
}

export async function workerReadiness(
  prisma: PrismaService,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; body: Record<string, unknown> }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      body: {
        status: 'ok',
        role: 'worker',
        database: 'up',
        timestamp: new Date().toISOString(),
      },
    };
  } catch {
    return {
      ok: false,
      body: {
        code: 'NOT_READY',
        message: 'Database unavailable',
      },
    };
  }
}
