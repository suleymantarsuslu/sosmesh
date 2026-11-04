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
import { detectConfidentLanguage } from '../language-heuristic';
import { MetaModelClient } from '../meta-model-client';
import { BudgetGuardService } from '../budget-guard.service';
import { AudioConversionService } from '../../media/audio-conversion.service';
import { AudioChunkingService } from '../../media/audio-chunking.service';
import { MediaStorage, MEDIA_STORAGE } from '../../media/media-storage.interface';
import { AiJobQueueService } from '../ai-job-queue.service';
import { Inject } from '@nestjs/common';
import { ASR_CHUNK_MAX_SECONDS } from '../../media/media.constants';

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
    private readonly chunking: AudioChunkingService,
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

    const estimatedCost = this.metaClient.computeAsrCost(attachment.durationMs ?? 0);

    const reservation = await this.budgetGuard.reserve(estimatedCost, 'muse-voice-transcribe-1.0');

    if (!reservation.reserved) {
      this.logger.warn({
        msg: 'Budget exceeded for ASR',
        attachmentId,
        reason: !('reservationId' in reservation) && 'reason' in reservation ? reservation.reason : 'unknown',
      });
      return { success: false, reason: 'budget_exceeded' };
    }

    try {
      const audioBuffer = await this.storage.retrieve(attachment.storageKey);

      if (!audioBuffer) {
        await this.budgetGuard.reconcile({
          reservationId: reservation.reservationId,
          actualUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          model: 'muse-voice-transcribe-1.0',
          requestId: 'not_found',
        });
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

        await this.budgetGuard.reconcile({
          reservationId: reservation.reservationId,
          actualUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          model: 'muse-voice-transcribe-1.0',
          requestId: 'conversion_failed',
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

      // Handle long audio by chunking
      let fullTranscript = '';
      let totalAudioDurationMs = durationMs;

      if (durationMs > ASR_CHUNK_MAX_SECONDS * 1000) {
        this.logger.log({
          msg: 'Audio exceeds ASR chunk limit, splitting',
          durationMs,
          maxChunkMs: ASR_CHUNK_MAX_SECONDS * 1000,
        });

        const chunks = await this.chunking.chunkWavFile(wavBuffer, durationMs);

        for (const chunk of chunks) {
          const chunkResponse = await this.metaClient.transcribe({
            wavBuffer: chunk.buffer,
            languageBias,
            keywords,
            mode: 'PUSH_TO_TALK',
          });

          if (!chunkResponse.ok) {
            this.logger.error({
              msg: 'ASR chunk failed',
              attachmentId,
              chunkIndex: chunk.chunkIndex,
              error: 'error' in chunkResponse ? chunkResponse.error : 'unknown',
            });

            await this.budgetGuard.reconcile({
              reservationId: reservation.reservationId,
              actualUsd: 0,
              inputTokens: 0,
              outputTokens: 0,
              model: 'muse-voice-transcribe-1.0',
              requestId: 'chunk_failed',
            });

            const retryable = 'retryable' in chunkResponse ? chunkResponse.retryable : false;
            const error = 'error' in chunkResponse ? chunkResponse.error : 'unknown';

            return {
              success: false,
              reason: retryable ? 'unavailable' : 'asr_failed',
              error,
            };
          }

          if (fullTranscript && chunkResponse.transcript) {
            fullTranscript += ' ' + chunkResponse.transcript;
          } else {
            fullTranscript = chunkResponse.transcript;
          }
        }

        const actualCost = this.metaClient.computeAsrCost(totalAudioDurationMs);

        await this.budgetGuard.reconcile({
          reservationId: reservation.reservationId,
          actualUsd: actualCost,
          inputTokens: 0,
          outputTokens: 0,
          model: 'muse-voice-transcribe-1.0',
          requestId: `chunked_${chunks.length}`,
        });
      } else {
        const asrRequest = {
          wavBuffer,
          languageBias,
          keywords,
          mode: 'PUSH_TO_TALK' as const,
        };

        const asrResponse = await this.metaClient.transcribe(asrRequest);

      if (!asrResponse.ok) {
        this.logger.error({
          msg: 'ASR failed',
          attachmentId,
          error: 'error' in asrResponse ? asrResponse.error : 'unknown',
          retryable: 'retryable' in asrResponse ? asrResponse.retryable : false,
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

        const retryable = 'retryable' in asrResponse ? asrResponse.retryable : false;
        const error = 'error' in asrResponse ? asrResponse.error : 'unknown';

        return {
          success: false,
          reason: retryable ? 'unavailable' : 'asr_failed',
          error,
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

        fullTranscript = asrResponse.transcript;
        totalAudioDurationMs = asrResponse.audioDurationMs;
      }

      // The note-text hint only biases the ASR; the stored language must describe the speech itself.
      const spoken = detectConfidentLanguage(fullTranscript);
      const language = spoken === 'unknown' ? detectedLanguage : spoken;

      const transcript = await this.prisma.aiTranscript.create({
        data: {
          attachmentId: attachment.id,
          model: 'muse-voice-transcribe-1.0',
          transcript: fullTranscript,
          turns: [],
          language,
          audioDurationMs: totalAudioDurationMs,
        },
      });

      this.logger.log({
        msg: 'Transcription completed',
        transcriptId: transcript.id,
        attachmentId,
        transcriptLength: fullTranscript.length,
        language,
        durationMs: totalAudioDurationMs,
      });

      const triageJobId = await this.jobQueue.enqueue({
        kind: 'triage',
        incidentId: attachment.incidentId,
        sosMessageId: attachment.sosMessageId ?? undefined,
        // Idempotency key must differ from the ingest-time triage job, otherwise this enqueue
        // returns the already-completed text-only triage and the transcript is never analysed.
        metadata: { transcriptId: transcript.id },
      });

      return {
        success: true,
        transcriptId: transcript.id,
        transcript: fullTranscript,
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
