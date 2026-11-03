/**
 * Requeue Triage Script
 * 
 * Safely requeues AI triage jobs that are in 'requires_review' status
 * due to missing plaintext (decryption failures).
 * 
 * This script is idempotent and operator-safe:
 * - Only affects jobs in 'requires_review' status with plaintext-related failures
 * - Uses AI job queue's built-in idempotency (will skip if job already pending/processing)
 * - Does not delete any data
 * 
 * Usage:
 *   npm run requeue-failed-triage [--dry-run]
 * 
 * Options:
 *   --dry-run  Show what would be requeued without making changes
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log(`Starting failed triage requeue (${isDryRun ? 'DRY RUN' : 'LIVE'})`);

  const prisma = new PrismaClient();

  try {
    const failedJobs = await prisma.aiJob.findMany({
      where: {
        kind: 'triage',
        status: 'requires_review',
        lastError: {
          contains: 'plaintext',
        },
      },
      select: {
        id: true,
        incidentId: true,
        sosMessageId: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`Found ${failedJobs.length} triage jobs requiring review due to missing plaintext`);

    if (failedJobs.length === 0) {
      console.log('No jobs to requeue');
      await prisma.$disconnect();
      return;
    }

    if (isDryRun) {
      console.log('\nDRY RUN - Would requeue the following jobs:');
      for (const job of failedJobs) {
        console.log(`  - Job ${job.id}:`);
        console.log(`    Incident: ${job.incidentId}`);
        console.log(`    Message: ${job.sosMessageId}`);
        console.log(`    Error: ${job.lastError?.substring(0, 100)}`);
        console.log(`    Created: ${job.createdAt.toISOString()}`);
      }
      console.log('\nRun without --dry-run to requeue these jobs');
    } else {
      console.log('\nRequeuing jobs...');
      let requeuedCount = 0;
      let skippedCount = 0;

      for (const job of failedJobs) {
        try {
          await prisma.$transaction(async (tx) => {
            const existing = await tx.aiJob.findFirst({
              where: {
                kind: 'triage',
                incidentId: job.incidentId,
                sosMessageId: job.sosMessageId,
                status: {
                  in: ['pending', 'processing'],
                },
              },
            });

            if (existing) {
              console.log(`  ✓ Job ${job.id} - Already pending/processing (${existing.id}), skipping`);
              skippedCount++;
              return;
            }

            await tx.aiJob.update({
              where: { id: job.id },
              data: {
                status: 'pending',
                attempts: 0,
                lastError: null,
                startedAt: null,
                completedAt: null,
              },
            });

            console.log(`  ✓ Job ${job.id} - Requeued`);
            requeuedCount++;
          });
        } catch (error) {
          console.error(`  ✗ Job ${job.id} - Failed to requeue:`, error);
        }
      }

      console.log(`\nRequeue complete:`);
      console.log(`  - Requeued: ${requeuedCount}`);
      console.log(`  - Skipped: ${skippedCount}`);
      console.log(`  - Total: ${failedJobs.length}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
