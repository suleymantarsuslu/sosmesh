/**
 * AiJobQueue - Postgres-based durable job queue
 * Work Package A - AI Foundation
 * 
 * Uses FOR UPDATE SKIP LOCKED for concurrent job processing
 * Idempotency via unique idempotency_key
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type EnqueueJobRequest = {
  kind: 'triage' | 'transcribe' | 'vision' | 'fusion';
  incidentId?: string;
  sosMessageId?: string;
  attachmentId?: string;
  metadata?: Record<string, unknown>;
};

export type AiJob = {
  id: string;
  kind: string;
  incidentId: string | null;
  sosMessageId: string | null;
  attachmentId: string | null;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

@Injectable()
export class AiJobQueueService {
  private readonly logger = new Logger(AiJobQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enqueue a job with idempotency
   * Returns existing job if idempotency key already exists
   */
  async enqueue(request: EnqueueJobRequest): Promise<string> {
    const idempotencyKey = this.buildIdempotencyKey(request);

    try {
      const job = await this.prisma.aiJob.create({
        data: {
          kind: request.kind,
          incidentId: request.incidentId ?? null,
          sosMessageId: request.sosMessageId ?? null,
          attachmentId: request.attachmentId ?? null,
          idempotencyKey,
          status: 'pending',
          attempts: 0,
        },
      });

      this.logger.log({
        msg: 'Job enqueued',
        jobId: job.id,
        kind: request.kind,
        idempotencyKey,
      });

      return job.id;
    } catch (error) {
      // P2002 = unique constraint violation (idempotency key already exists)
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        const existing = await this.prisma.aiJob.findUnique({
          where: { idempotencyKey },
        });

        if (existing) {
          this.logger.debug({
            msg: 'Job already exists (idempotency)',
            jobId: existing.id,
            idempotencyKey,
          });
          return existing.id;
        }
      }

      throw error;
    }
  }

  /**
   * Claim next available job for processing
   * Uses FOR UPDATE SKIP LOCKED for concurrency
   */
  async claimNext(): Promise<AiJob | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Find and lock next pending job
        const job = await tx.$queryRaw<Array<{
          id: string;
          kind: string;
          incident_id: string | null;
          sos_message_id: string | null;
          attachment_id: string | null;
          status: string;
          attempts: number;
          last_error: string | null;
          created_at: Date;
          started_at: Date | null;
          completed_at: Date | null;
        }>>`
          SELECT *
          FROM ai_jobs
          WHERE status = 'pending'
            AND attempts < 3
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `;

        if (job.length === 0) {
          return null;
        }

        const claimed = job[0];

        // Update job status to processing
        await tx.aiJob.update({
          where: { id: claimed.id },
          data: {
            status: 'processing',
            startedAt: new Date(),
            attempts: claimed.attempts + 1,
          },
        });

        return {
          id: claimed.id,
          kind: claimed.kind,
          incidentId: claimed.incident_id,
          sosMessageId: claimed.sos_message_id,
          attachmentId: claimed.attachment_id,
          status: 'processing',
          attempts: claimed.attempts + 1,
          lastError: claimed.last_error,
          createdAt: claimed.created_at,
          startedAt: new Date(),
          completedAt: claimed.completed_at,
        };
      });
    } catch (error) {
      this.logger.error({
        errorCode: error instanceof Error ? error.constructor.name : 'CLAIM_FAILED',
        message: error instanceof Error ? error.message.substring(0, 200) : 'unknown',
        msg: 'Failed to claim job',
      });
      return null;
    }
  }

  /**
   * Mark job as completed
   */
  async complete(jobId: string): Promise<void> {
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        lastError: null,
      },
    });

    this.logger.log({ msg: 'Job completed', jobId });
  }

  /**
   * Mark job as failed
   */
  async fail(jobId: string, error: string): Promise<void> {
    const job = await this.prisma.aiJob.findUnique({
      where: { id: jobId },
      select: { attempts: true },
    });

    const status = (job?.attempts ?? 0) >= 3 ? 'failed' : 'pending';

    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status,
        lastError: error.substring(0, 1000),
        ...(status === 'failed' ? { completedAt: new Date() } : {}),
      },
    });

    this.logger.warn({
      msg: 'Job failed',
      jobId,
      error,
      finalStatus: status,
    });
  }

  /**
   * Mark job as requiring human review
   */
  async requiresReview(jobId: string, reason: string): Promise<void> {
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: 'requires_review',
        lastError: reason.substring(0, 1000),
        completedAt: new Date(),
      },
    });

    this.logger.log({ msg: 'Job requires review', jobId, reason });
  }

  /**
   * Get queue depth (pending jobs count)
   */
  async getQueueDepth(): Promise<number> {
    return this.prisma.aiJob.count({
      where: {
        status: 'pending',
        attempts: { lt: 3 },
      },
    });
  }

  /**
   * Get job statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    requiresReview: number;
  }> {
    const results = await this.prisma.aiJob.groupBy({
      by: ['status'],
      _count: true,
    });

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      requiresReview: 0,
    };

    for (const result of results) {
      const count = result._count;
      switch (result.status) {
        case 'pending':
          stats.pending = count;
          break;
        case 'processing':
          stats.processing = count;
          break;
        case 'completed':
          stats.completed = count;
          break;
        case 'failed':
          stats.failed = count;
          break;
        case 'requires_review':
          stats.requiresReview = count;
          break;
      }
    }

    return stats;
  }

  private buildIdempotencyKey(request: EnqueueJobRequest): string {
    const parts = [
      request.kind,
      request.incidentId ?? '',
      request.sosMessageId ?? '',
      request.attachmentId ?? '',
      JSON.stringify(request.metadata ?? {}),
    ];

    const hash = createHash('sha256').update(parts.join('|')).digest('hex');
    return `${request.kind}_${hash.substring(0, 32)}`;
  }
}
