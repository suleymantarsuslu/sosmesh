/**
 * Voice Transcription Service - Process audio → transcript → triage
 * Work Package B - Voice Rescue
 * 
 * Flow:
 * 1. Load attachment and audio from storage
 * 2. Convert to WAV 16kHz mono
 * 3. Call MetaModelClient.transcribe with TR/EN language bias
 * 4. Write AiTranscript
 * 5. Enqueue triage job with transcript as input
 * 6. On ASR failure: mark as failed/unavailable, SOS continues working
 * 7. Reserve budget at $0.18/hour
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaModelClient } from '../meta-model-client';
import { BudgetGuardService } from '../budget-guard.service';
import { AudioConversionService } from '../../media/audio-conversion.service';
import { MediaStorage, MEDIA_STORAGE } from '../../media/media-storage.interface';
import { AiJobQueueService } from '../ai-job-queue.service';
import { Inject } from '@nestjs/common';

const KEYWORDS_TR = ['enkaz', 'yaralı', 'yangın', 'sel', 'yardım', 'mahsur', 'acil'];
const KEYWORDS_EN = ['trapped', 'injured', 'fire', 'flood', 'help', 'emergency', 'rescue'];

export type TranscriptionJobResult = {
  success: true;
  transcriptId: string;
  transcript: string;
  triageJobId: string;
} | {
  success: false;
  reason: 'not_found' | 'budget_exceeded' | 'conversion_failed' | 'asr_failed' | 'unavailable';
  error?: string;
};

@Injectable()
export class VoiceTranscriptionService {
  private readonly logger = new Logger(VoiceTranscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaClient: MetaModelClient,
    private readonly budgetGuard: BudgetGuardService,
    private readonly conversion: AudioConversionService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly jobQueue: AiJobQueueService
  ) {}

  async processTranscription(attachmentId: string): Promise<TranscriptionJobResult> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        sosMessage: {
          select: { id: true, incidentId: true },
        },
      },
    });

    if (!attachment) {
      return { success: false, reason: 'not_found' };
    }

    const estimatedHours = (attachment.durationMs ?? 0) / 3_600_000;
    const estimatedCost = this.metaClient.computeAsrCost(attachment.durationMs ?? 0);

    const reservation = await this.budgetGuard.reserve(estimatedCost, 'muse-voice-transcribe-1.0');

    if (!reservation.reserved) {
      this.logger.warn({
        msg: 'Budget exceeded for ASR',
        attachmentId,
        reason: reservation.reason,
      });
      return { success: false, reason: 'budget_exceeded' };
    }

    try {
      const audioBuffer = await this.storage.retrieve(attachment.storageKey);

      if (!audioBuffer) {
        return { success: false, reason: 'not_found' };
      }

      let wavBuffer: Buffer;
      let durationMs: number;

      try {
        const converted = await this.conversion.convertToWav({
          inputBuffer: audioBuffer,
          inputMime: attachment.mime,
        });
        wavBuffer = converted.wavBuffer;
        durationMs = converted.durationMs;
      } catch (error) {
        this.logger.error({
          err: error,
          msg: 'Audio conversion failed',
          attachmentId,
        });
        return { success: false, reason: 'conversion_failed', error: String(error) };
      }

      const sosMessage = await this.prisma.sosMessage.findFirst({
        where: {
          OR: [
            { id: attachment.sosMessageId ?? '' },
            { incidentId: attachment.incidentId },
          ],
        },
        select: { operatorDisplayText: true },
        orderBy: { createdAt: 'desc' },
      });

      const textHint = sosMessage?.operatorDisplayText ?? '';
      const detectedLanguage = this.detectLanguage(textHint);
      const languageBias = detectedLanguage === 'tr' ? ['Turkish', 'English'] : ['English', 'Turkish'];
      const keywords = detectedLanguage === 'tr' ? KEYWORDS_TR : KEYWORDS_EN;

      const asrRequest = {
        wavBuffer,
        languageBias,
        mode: 'PUSH_TO_TALK' as const,
      };

      const asrResponse = await this.metaClient.transcribe(asrRequest);

      if (!asrResponse.ok) {
        this.logger.error({
          msg: 'ASR failed',
          attachmentId,
          error: asrResponse.error,
          retryable: asrResponse.retryable,
        });

        const actualCost = 0;
        await this.budgetGuard.reconcile({
          reservationId: reservation.reservationId,
          actualUsd: actualCost,
          inputTokens: 0,
          outputTokens: 0,
          model: 'muse-voice-transcribe-1.0',
          requestId: 'failed',
        });

        return {
          success: false,
          reason: asrResponse.retryable ? 'unavailable' : 'asr_failed',
          error: asrResponse.error,
        };
      }

      const actualCost = this.metaClient.computeAsrCost(asrResponse.audioDurationMs);

      await this.budgetGuard.reconcile({
        reservationId: reservation.reservationId,
        actualUsd: actualCost,
        inputTokens: 0,
        outputTokens: 0,
        model: 'muse-voice-transcribe-1.0',
        requestId: asrResponse.sessionId,
      });

      const language = detectedLanguage;

      const transcript = await this.prisma.aiTranscript.create({
        data: {
          attachmentId: attachment.id,
          model: 'muse-voice-transcribe-1.0',
          transcript: asrResponse.transcript,
          turns: asrResponse.turns,
          language,
          audioDurationMs: asrResponse.audioDurationMs,
        },
      });

      this.logger.log({
        msg: 'Transcription completed',
        transcriptId: transcript.id,
        attachmentId,
        transcript: asrResponse.transcript.substring(0, 100),
        language,
      });

      const triageJobId = await this.jobQueue.enqueue({
        kind: 'triage',
        incidentId: attachment.incidentId,
        sosMessageId: attachment.sosMessageId ?? undefined,
        metadata: { transcriptText: asrResponse.transcript },
      });

      return {
        success: true,
        transcriptId: transcript.id,
        transcript: asrResponse.transcript,
        triageJobId,
      };
    } catch (error) {
      this.logger.error({
        err: error,
        msg: 'Transcription processing error',
        attachmentId,
      });

      return {
        success: false,
        reason: 'unavailable',
        error: error instanceof Error ? error.message : 'unknown',
      };
    }
  }

  private detectLanguage(text: string): 'tr' | 'en' {
    const lower = text.toLowerCase();
    const trWords = ['yardım', 'enkaz', 'yaralı', 'yangın', 'sel', 'mahsur', 'acil', 'kişi'];
    const trCount = trWords.filter((w) => lower.includes(w)).length;

    return trCount >= 2 ? 'tr' : 'en';
  }
}
