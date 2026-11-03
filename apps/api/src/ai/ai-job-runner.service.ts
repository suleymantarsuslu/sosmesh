/**
 * AiJobRunner - processes AI jobs from the queue
 * Work Package A - AI Foundation
 * 
 * Runs in worker process, claims and processes jobs one at a time
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiJobQueueService, type AiJob } from './ai-job-queue.service';
import { TriageV2Service } from './triage-v2.service';
import { SosPlaintextSource, SOS_PLAINTEXT_SOURCE } from './sos-plaintext-source';
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';
import { VisionAnalysisService } from './vision/vision-analysis.service';
import { LocalDiskStorageService } from '../media/local-disk-storage.service';

@Injectable()
export class AiJobRunnerService {
  private readonly logger = new Logger(AiJobRunnerService.name);
  private running = false;

  constructor(
    private readonly queue: AiJobQueueService,
    private readonly triage: TriageV2Service,
    private readonly prisma: PrismaService,
    private readonly vision: VisionAnalysisService,
    private readonly storage: LocalDiskStorageService,
    @Inject(SOS_PLAINTEXT_SOURCE) private readonly plaintextSource: SosPlaintextSource
  ) {}

  /**
   * Start processing jobs in a loop
   * Runs continuously until stopped
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Job runner already running');
      return;
    }

    this.running = true;
    this.logger.log('AI job runner started');

    while (this.running) {
      try {
        const job = await this.queue.claimNext();

        if (!job) {
          // No jobs available, wait before checking again
          await this.sleep(5000);
          continue;
        }

        await this.processJob(job);
      } catch (error) {
        this.logger.error({ err: error, msg: 'Job runner error' });
        await this.sleep(10000);
      }
    }
  }

  /**
   * Stop the job runner
   */
  stop(): void {
    this.logger.log('Stopping AI job runner');
    this.running = false;
  }

  private async processJob(job: AiJob): Promise<void> {
    this.logger.log({ msg: 'Processing job', jobId: job.id, kind: job.kind });

    try {
      switch (job.kind) {
        case 'triage':
          await this.processTriage(job);
          break;
        case 'transcribe':
          this.logger.warn({ msg: 'Transcribe not implemented yet', jobId: job.id });
          await this.queue.complete(job.id);
          break;
        case 'vision':
          await this.processVision(job);
          break;
        case 'fusion':
          this.logger.warn({ msg: 'Fusion not implemented yet', jobId: job.id });
          await this.queue.complete(job.id);
          break;
        default:
          await this.queue.fail(job.id, `Unknown job kind: ${job.kind}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown_error';
      await this.queue.fail(job.id, errorMessage);
      this.logger.error({ err: error, jobId: job.id, msg: 'Job failed' });
    }
  }

  private async processTriage(job: AiJob): Promise<void> {
    if (!job.incidentId) {
      await this.queue.fail(job.id, 'Missing incidentId');
      return;
    }

    // Get SOS message
    const sosMessage = job.sosMessageId
      ? await this.prisma.sosMessage.findUnique({
          where: { id: job.sosMessageId },
          select: { messageId: true, operatorDisplayText: true, noteText: true },
        })
      : null;

    if (!sosMessage) {
      await this.queue.fail(job.id, 'SOS message not found');
      return;
    }

    // Try to get plaintext
    let plaintext = sosMessage.noteText;

    if (!plaintext) {
      plaintext = await this.plaintextSource.getPlaintext({
        incidentId: job.incidentId,
        messageId: sosMessage.messageId,
      });
    }

    // Fall back to operator display text
    if (!plaintext && sosMessage.operatorDisplayText) {
      plaintext = sosMessage.operatorDisplayText;
    }

    if (!plaintext) {
      await this.queue.requiresReview(job.id, 'No plaintext available');
      return;
    }

    // Run triage
    const result = await this.triage.analyzeIncident(job.incidentId, plaintext);

    if (result.success) {
      await this.queue.complete(job.id);
    } else {
      const errorMsg = 'error' in result ? result.error : 'unknown_error';
      await this.queue.fail(job.id, errorMsg);
    }
  }

  private async processVision(job: AiJob): Promise<void> {
    const attachmentId = job.metadata?.attachmentId as string | undefined;

    if (!attachmentId) {
      await this.queue.fail(job.id, 'Missing attachmentId in job metadata');
      return;
    }

    // Get attachment with incident context
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        storageKey: true,
        mime: true,
        kind: true,
        incident: {
          select: {
            sosMessages: {
              select: {
                operatorDisplayText: true,
                noteText: true,
              },
              take: 1,
              orderBy: { receivedAt: 'desc' },
            },
          },
        },
      },
    });

    if (!attachment) {
      await this.queue.fail(job.id, 'Attachment not found');
      return;
    }

    if (attachment.kind !== 'photo') {
      await this.queue.fail(job.id, `Not a photo: kind=${attachment.kind}`);
      return;
    }

    // Retrieve image from storage
    const imageBuffer = await this.storage.retrieve(attachment.storageKey);

    if (!imageBuffer) {
      await this.queue.fail(job.id, 'Image not found in storage');
      return;
    }

    // Get incident context for better analysis
    const sosMessage = attachment.incident.sosMessages[0];
    const incidentContext =
      sosMessage?.noteText || sosMessage?.operatorDisplayText || undefined;

    // Run vision analysis
    const result = await this.vision.analyzePhoto({
      attachmentId: attachment.id,
      imageBuffer,
      mimeType: attachment.mime,
      incidentContext,
    });

    if (result.success) {
      await this.queue.complete(job.id);
    } else {
      await this.queue.fail(job.id, result.error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
