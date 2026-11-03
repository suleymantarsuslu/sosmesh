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
import { VoiceTranscriptionService } from './voice/voice-transcription.service';

@Injectable()
export class AiJobRunnerService {
  private readonly logger = new Logger(AiJobRunnerService.name);
  private running = false;

  constructor(
    private readonly queue: AiJobQueueService,
    private readonly triage: TriageV2Service,
    private readonly prisma: PrismaService,
    @Inject(SOS_PLAINTEXT_SOURCE) private readonly plaintextSource: SosPlaintextSource,
    private readonly voiceTranscription: VoiceTranscriptionService
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
          await this.processTranscribe(job);
          break;
        case 'vision':
          this.logger.warn({ msg: 'Vision not implemented yet', jobId: job.id });
          await this.queue.complete(job.id);
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

    // Get SOS message if available
    const sosMessage = job.sosMessageId
      ? await this.prisma.sosMessage.findUnique({
          where: { id: job.sosMessageId },
          select: { messageId: true, operatorDisplayText: true, noteText: true },
        })
      : await this.prisma.sosMessage.findFirst({
          where: { incidentId: job.incidentId },
          orderBy: { createdAt: 'desc' },
          select: { messageId: true, operatorDisplayText: true, noteText: true },
        });

    // Try to get plaintext from SOS
    let plaintext = '';

    if (sosMessage) {
      if (sosMessage.noteText) {
        plaintext = sosMessage.noteText;
      } else {
        const decrypted = await this.plaintextSource.getPlaintext({
          incidentId: job.incidentId,
          messageId: sosMessage.messageId,
        });
        if (decrypted) {
          plaintext = decrypted;
        } else if (sosMessage.operatorDisplayText) {
          plaintext = sosMessage.operatorDisplayText;
        }
      }
    }

    // Get latest successful transcript
    const latestTranscript = await this.prisma.aiTranscript.findFirst({
      where: {
        attachment: {
          incidentId: job.incidentId,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { transcript: true },
    });

    // Combine text and transcript
    if (latestTranscript?.transcript) {
      const transcriptText = `\n\n[Voice transcript (machine-generated, may contain errors)]:\n${latestTranscript.transcript}`;
      if (plaintext) {
        plaintext = plaintext + transcriptText;
      } else {
        plaintext = transcriptText.trim();
      }
    }

    if (!plaintext) {
      await this.queue.requiresReview(job.id, 'No plaintext or transcript available');
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

  private async processTranscribe(job: AiJob): Promise<void> {
    if (!job.attachmentId) {
      await this.queue.fail(job.id, 'Missing attachmentId');
      return;
    }

    const result = await this.voiceTranscription.processTranscription(job.attachmentId);

    if (!result.success) {
      const errorMsg = ('error' in result ? result.error : undefined) ?? ('reason' in result ? result.reason : 'unknown');
      const reason = 'reason' in result ? result.reason : 'unknown';
      
      if (reason === 'unavailable' || reason === 'budget_exceeded') {
        await this.queue.requiresReview(job.id, errorMsg);
      } else {
        await this.queue.fail(job.id, errorMsg);
      }
      return;
    }

    this.logger.log({
      msg: 'Transcription job completed',
      jobId: job.id,
      transcriptId: result.transcriptId,
      triageJobId: result.triageJobId,
    });
    await this.queue.complete(job.id);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
