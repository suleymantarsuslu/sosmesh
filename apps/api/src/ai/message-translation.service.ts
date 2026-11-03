/**
 * Message Translation Service
 * Translates incoming SOS messages and transcripts to operator's locale
 * Budget-guarded, server-side only, never logs plaintext
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaModelClient } from './meta-model-client';
import { BudgetGuardService } from './budget-guard.service';
import type { OperatorLocale } from './locale-content.service';

const TRANSLATION_SCHEMA = {
  name: 'sos_translation',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      translated_text: {
        type: 'string',
      },
      detected_language: {
        type: 'string',
      },
    },
    required: ['translated_text', 'detected_language'],
    additionalProperties: false,
  },
};

type TranslationResult = {
  translatedText: string;
  detectedLanguage: string;
  cached: boolean;
} | null;

@Injectable()
export class MessageTranslationService {
  private readonly logger = new Logger(MessageTranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaClient: MetaModelClient,
    private readonly budgetGuard: BudgetGuardService
  ) {}

  /**
   * Translate incoming SOS message text to target locale
   * Returns null if AI unavailable or text doesn't need translation
   */
  async translateMessage(
    messageId: string,
    originalText: string,
    targetLocale: OperatorLocale
  ): Promise<TranslationResult> {
    if (!originalText || originalText.trim().length === 0) {
      return null;
    }

    const detectedLang = this.detectLanguage(originalText);
    const sourceLanguage = detectedLang === 'turkish' ? 'tr' : 'en';

    if (sourceLanguage === targetLocale) {
      return null;
    }

    const cached = await this.getCachedTranslation('sos_message', messageId, 'noteText', targetLocale);
    if (cached) {
      return {
        translatedText: cached.translatedText,
        detectedLanguage: cached.sourceLanguage,
        cached: true,
      };
    }

    if (process.env.AI_ENABLED !== 'true') {
      return null;
    }

    const estimatedCost = 0.005;
    const reservation = await this.budgetGuard.reserve(estimatedCost, this.metaClient['sparkModel']);

    if (!reservation.reserved) {
      this.logger.warn({ msg: 'Translation budget limit reached', messageId });
      return null;
    }

    try {
      const targetLanguageName = targetLocale === 'tr' ? 'Turkish' : 'English';
      
      const systemPrompt = `You are a professional translator for emergency services. Translate the following SOS message accurately and naturally to ${targetLanguageName}. Preserve urgency, emotion, and specific details. Do not add explanations or interpretations.`;

      const prompt = `Translate this emergency message to ${targetLanguageName}:

${originalText}

Provide the translation and the detected source language.`;

      const response = await this.metaClient.chatJson({
        schema: TRANSLATION_SCHEMA,
        prompt,
        systemPrompt,
        reasoningEffort: 'minimal',
      });

      if (!response.ok) {
        this.logger.error({ msg: 'Translation failed', error: 'error' in response ? response.error : 'unknown' });
        return null;
      }

      const result = response.json;
      const actualCost = this.metaClient.computeCost(
        response.model,
        response.usage.inputTokens,
        response.usage.outputTokens
      );

      await this.budgetGuard.reconcile({
        reservationId: reservation.reservationId,
        actualUsd: actualCost,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        model: response.model,
        requestId: response.requestId,
      });

      await this.cacheTranslation({
        sourceType: 'sos_message',
        sourceId: messageId,
        sourceField: 'noteText',
        sourceLanguage,
        targetLanguage: targetLocale,
        translatedText: result.translated_text as string,
        modelVersion: response.model,
      });

      this.logger.log({
        msg: 'Message translated',
        messageId,
        from: sourceLanguage,
        to: targetLocale,
        costUsd: actualCost,
      });

      return {
        translatedText: result.translated_text as string,
        detectedLanguage: result.detected_language as string,
        cached: false,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Translation error',
        messageId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * Translate transcript text
   */
  async translateTranscript(
    transcriptId: string,
    originalText: string,
    targetLocale: OperatorLocale
  ): Promise<TranslationResult> {
    if (!originalText || originalText.trim().length === 0) {
      return null;
    }

    const detectedLang = this.detectLanguage(originalText);
    const sourceLanguage = detectedLang === 'turkish' ? 'tr' : 'en';

    if (sourceLanguage === targetLocale) {
      return null;
    }

    const cached = await this.getCachedTranslation('ai_transcript', transcriptId, 'transcript', targetLocale);
    if (cached) {
      return {
        translatedText: cached.translatedText,
        detectedLanguage: cached.sourceLanguage,
        cached: true,
      };
    }

    if (process.env.AI_ENABLED !== 'true') {
      return null;
    }

    const estimatedCost = 0.005;
    const reservation = await this.budgetGuard.reserve(estimatedCost, this.metaClient['sparkModel']);

    if (!reservation.reserved) {
      this.logger.warn({ msg: 'Translation budget limit reached', transcriptId });
      return null;
    }

    try {
      const targetLanguageName = targetLocale === 'tr' ? 'Turkish' : 'English';
      
      const systemPrompt = `You are a professional translator for emergency services. Translate the following voice transcript accurately and naturally to ${targetLanguageName}. Preserve the conversational tone and urgency.`;

      const prompt = `Translate this emergency voice transcript to ${targetLanguageName}:

${originalText}

Provide the translation and the detected source language.`;

      const response = await this.metaClient.chatJson({
        schema: TRANSLATION_SCHEMA,
        prompt,
        systemPrompt,
        reasoningEffort: 'minimal',
      });

      if (!response.ok) {
        this.logger.error({ msg: 'Transcript translation failed', error: 'error' in response ? response.error : 'unknown' });
        return null;
      }

      const result = response.json;
      const actualCost = this.metaClient.computeCost(
        response.model,
        response.usage.inputTokens,
        response.usage.outputTokens
      );

      await this.budgetGuard.reconcile({
        reservationId: reservation.reservationId,
        actualUsd: actualCost,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        model: response.model,
        requestId: response.requestId,
      });

      await this.cacheTranslation({
        sourceType: 'ai_transcript',
        sourceId: transcriptId,
        sourceField: 'transcript',
        sourceLanguage,
        targetLanguage: targetLocale,
        translatedText: result.translated_text as string,
        modelVersion: response.model,
      });

      this.logger.log({
        msg: 'Transcript translated',
        transcriptId,
        from: sourceLanguage,
        to: targetLocale,
        costUsd: actualCost,
      });

      return {
        translatedText: result.translated_text as string,
        detectedLanguage: result.detected_language as string,
        cached: false,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Transcript translation error',
        transcriptId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  private detectLanguage(text: string): 'turkish' | 'english' {
    const lower = text.toLowerCase();
    const turkishMarkers = [
      'deprem', 'yangın', 'yardım', 'enkaz', 'lütfen', 'bilmiyoruz',
      'mahsur', 'kaldık', 'var', 'yok', 'çok', 'için', 'ile', 'bir',
      'şu', 'bu', 'biz', 'siz', 'onlar', 've', 'veya', 'ama',
    ];
    
    let turkishCount = 0;
    for (const marker of turkishMarkers) {
      if (lower.includes(marker)) turkishCount++;
    }
    
    return turkishCount >= 2 ? 'turkish' : 'english';
  }

  private async getCachedTranslation(
    sourceType: string,
    sourceId: string,
    sourceField: string,
    targetLanguage: string
  ): Promise<{ translatedText: string; sourceLanguage: string } | null> {
    const cached = await this.prisma.aiTranslationCache.findUnique({
      where: {
        sourceType_sourceId_sourceField_targetLanguage: {
          sourceType,
          sourceId,
          sourceField,
          targetLanguage,
        },
      },
    });

    if (!cached) return null;

    return {
      translatedText: cached.translatedText,
      sourceLanguage: cached.sourceLanguage,
    };
  }

  private async cacheTranslation(data: {
    sourceType: string;
    sourceId: string;
    sourceField: string;
    sourceLanguage: string;
    targetLanguage: string;
    translatedText: string;
    modelVersion: string;
  }): Promise<void> {
    await this.prisma.aiTranslationCache.create({
      data: {
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        sourceField: data.sourceField,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        translatedText: data.translatedText,
        modelVersion: data.modelVersion,
      },
    });
  }
}
