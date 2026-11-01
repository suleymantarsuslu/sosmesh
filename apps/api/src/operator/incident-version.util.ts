import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export async function assertIncidentVersionAndIncrement(
  tx: Tx,
  incidentId: string,
  expectedVersion: number
): Promise<number> {
  const bumped = await tx.incident.updateMany({
    where: { id: incidentId, version: expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (bumped.count === 1) {
    return expectedVersion + 1;
  }
  const current = await tx.incident.findUnique({
    where: { id: incidentId },
    select: { version: true },
  });
  if (!current) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
  }
  throw new ConflictException({
    code: 'VERSION_CONFLICT',
    message: 'Case was updated by another operator',
    currentVersion: current.version,
  });
}

export async function lockIncidentTransaction(tx: Tx, incidentId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${incidentId})::bigint)`);
}
