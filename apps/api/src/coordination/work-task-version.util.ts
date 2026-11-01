import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, WorkTaskStatus } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export async function assertWorkTaskVersion(
  tx: Tx,
  taskId: string,
  expectedVersion: number
): Promise<number> {
  const bumped = await tx.workTask.updateMany({
    where: { id: taskId, version: expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (bumped.count === 1) {
    return expectedVersion + 1;
  }
  const current = await tx.workTask.findUnique({
    where: { id: taskId },
    select: { version: true },
  });
  if (!current) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found' });
  }
  throw new ConflictException({
    code: 'VERSION_CONFLICT',
    message: 'Task was updated by another coordinator',
    currentVersion: current.version,
  });
}

export function assertTaskTransition(from: WorkTaskStatus, to: WorkTaskStatus): void {
  const allowed: Record<WorkTaskStatus, WorkTaskStatus[]> = {
    PROPOSED: [WorkTaskStatus.ASSIGNED, WorkTaskStatus.WITHDRAWN, WorkTaskStatus.CLOSED],
    ASSIGNED: [WorkTaskStatus.ACCEPTED, WorkTaskStatus.WITHDRAWN, WorkTaskStatus.CLOSED],
    ACCEPTED: [WorkTaskStatus.WITHDRAWN, WorkTaskStatus.CLOSED],
    WITHDRAWN: [WorkTaskStatus.CLOSED],
    CLOSED: [],
  };
  if (!allowed[from].includes(to)) {
    throw new ConflictException({
      code: 'INVALID_TRANSITION',
      message: `Cannot transition task from ${from} to ${to}`,
    });
  }
}

export async function lockWorkTaskTransaction(tx: Tx, taskId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${taskId})::bigint)`);
}
