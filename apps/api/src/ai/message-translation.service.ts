/**
 * Message Translation Service
 * Translates incoming SOS messages and transcripts to operator's locale
 * Budget-guarded, server-side only, never logs plaintext
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { detectConfidentLanguage } from './language-heuristic';
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
        description: 'ISO 639-1 language code (e.g. "tr", "en", "ar")',
      },
    },
    required: ['translated_text', 'detected_language'],
    additionalProperties: false,
  },
};

const CACHE_VERSION = 'v2';

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
   * Translation fields for a stored transcript, in the shape TranscriptView expects.
   * Skips the call when the transcript is already in the UI language; any failure yields nulls
   * so the original transcript is always shown.
   */
  async getTranscriptTranslationFields(
    transcriptId: string,
    transcriptText: string,
    transcriptLanguage: string | null,
    targetLocale: OperatorLocale
  ): Promise<{ translatedTranscript: string | null; translatedText: string | null; translationLanguage: string | null }> {
    const none = { translatedTranscript: null, translatedText: null, translationLanguage: null };
    if (transcriptLanguage === targetLocale) {
      return none;
    }
    try {
      const result = await this.translateTranscript(transcriptId, transcriptText, targetLocale);
      if (!result) {
        return none;
      }
      return {
        translatedTranscript: result.translatedText,
        translatedText: result.translatedText,
        translationLanguage: targetLocale,
      };
    } catch (error) {
      this.logger.warn({ msg: 'Transcript translation lookup failed', transcriptId, err: error });
      return none;
    }
  }

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

    const heuristicLang = this.detectLanguageHeuristic(originalText);

    const cached = await this.getCachedTranslation('sos_message', messageId, 'noteText', targetLocale);
    if (cached) {
      if (cached.sourceLanguage === targetLocale) {
        // Cached "already in the operator language" marker - no model call, no translation.
        return null;
      }
      return {
        translatedText: cached.translatedText,
        detectedLanguage: cached.sourceLanguage,
        cached: true,
      };
    }

    if (await this.cacheIfConfidentlySameLanguage('sos_message', messageId, 'noteText', originalText, targetLocale)) {
      return null;
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
      
      const systemPrompt = `You are a professional translator for emergency services. Translate the following SOS message accurately and naturally to ${targetLanguageName}. Preserve urgency, emotion, and specific details. Do not add explanations or interpretations. You must respond with valid JSON containing "translated_text" and "detected_language" (ISO 639-1 code like "tr", "en", "ar").`;

      const prompt = `Translate this emergency message to ${targetLanguageName}:

${originalText}

Provide:
1. "translated_text": The translated message in ${targetLanguageName}
2. "detected_language": The ISO 639-1 language code of the original message (e.g., "tr" for Turkish, "en" for English, "ar" for Arabic)`;

      const response = await this.metaClient.chatJson({
        schema: TRANSLATION_SCHEMA,
        prompt,
        systemPrompt,
        reasoningEffort: 'minimal',
      });

      if (!response.ok) {
        this.logger.error({ msg: 'Translation failed', error: 'error' in response ? response.error : 'unknown' });
        await this.releaseReservation(reservation.reservationId);
        return null;
      }

      const result = response.json;
      let detectedLang = (result.detected_language as string || '').toLowerCase();
      const translatedText = result.translated_text as string;

      if (heuristicLang === 'tr' && detectedLang !== 'tr') {
        this.logger.warn({
          msg: 'Language detection mismatch, overriding with heuristic',
          messageId,
          modelDetected: detectedLang,
          heuristicDetected: 'tr',
        });
        detectedLang = 'tr';
      }

      if (detectedLang === targetLocale) {
        this.logger.log({
          msg: 'Source equals target language, no translation needed',
          messageId,
          language: detectedLang,
        });
        await this.reconcileResponse(reservation.reservationId, response);
        await this.cacheTranslation({
          sourceType: 'sos_message',
          sourceId: messageId,
          sourceField: 'noteText',
          sourceLanguage: detectedLang,
          targetLanguage: targetLocale,
          translatedText: originalText,
          modelVersion: response.model,
        });
        return null;
      }

      if (translatedText === originalText && heuristicLang !== 'unknown' && heuristicLang !== targetLocale) {
        this.logger.warn({
          msg: 'Translation equals source despite language difference, treating as failure',
          messageId,
          detectedLang,
          heuristicLang,
        });
        await this.reconcileResponse(reservation.reservationId, response);
        return null;
      }

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
        sourceLanguage: detectedLang,
        targetLanguage: targetLocale,
        translatedText,
        modelVersion: response.model,
      });

      this.logger.log({
        msg: 'Message translated',
        messageId,
        from: detectedLang,
        to: targetLocale,
        costUsd: actualCost,
      });

      return {
        translatedText,
        detectedLanguage: detectedLang,
        cached: false,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Translation error',
        messageId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      await this.releaseReservation(reservation.reservationId);
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

    const heuristicLang = this.detectLanguageHeuristic(originalText);

    const cached = await this.getCachedTranslation('ai_transcript', transcriptId, 'transcript', targetLocale);
    if (cached) {
      if (cached.sourceLanguage === targetLocale) {
        return null;
      }
      return {
        translatedText: cached.translatedText,
        detectedLanguage: cached.sourceLanguage,
        cached: true,
      };
    }

    if (
      await this.cacheIfConfidentlySameLanguage('ai_transcript', transcriptId, 'transcript', originalText, targetLocale)
    ) {
      return null;
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
      
      const systemPrompt = `You are a professional translator for emergency services. Translate the following voice transcript accurately and naturally to ${targetLanguageName}. Preserve the conversational tone and urgency. You must respond with valid JSON containing "translated_text" and "detected_language" (ISO 639-1 code like "tr", "en", "ar").`;

      const prompt = `Translate this emergency voice transcript to ${targetLanguageName}:

${originalText}

Provide:
1. "translated_text": The translated transcript in ${targetLanguageName}
2. "detected_language": The ISO 639-1 language code of the original transcript (e.g., "tr" for Turkish, "en" for English, "ar" for Arabic)`;

      const response = await this.metaClient.chatJson({
        schema: TRANSLATION_SCHEMA,
        prompt,
        systemPrompt,
        reasoningEffort: 'minimal',
      });

      if (!response.ok) {
        this.logger.error({ msg: 'Transcript translation failed', error: 'error' in response ? response.error : 'unknown' });
        await this.releaseReservation(reservation.reservationId);
        return null;
      }

      const result = response.json;
      let detectedLang = (result.detected_language as string || '').toLowerCase();
      const translatedText = result.translated_text as string;

      if (heuristicLang === 'tr' && detectedLang !== 'tr') {
        this.logger.warn({
          msg: 'Language detection mismatch, overriding with heuristic',
          transcriptId,
          modelDetected: detectedLang,
          heuristicDetected: 'tr',
        });
        detectedLang = 'tr';
      }

      if (detectedLang === targetLocale) {
        this.logger.log({
          msg: 'Source equals target language, no translation needed',
          transcriptId,
          language: detectedLang,
        });
        // Record the spend and remember the verdict so the model is not called again on every refresh.
        await this.reconcileResponse(reservation.reservationId, response);
        await this.cacheTranslation({
          sourceType: 'ai_transcript',
          sourceId: transcriptId,
          sourceField: 'transcript',
          sourceLanguage: detectedLang,
          targetLanguage: targetLocale,
          translatedText: originalText,
          modelVersion: response.model,
        });
        return null;
      }

      if (translatedText === originalText && heuristicLang !== 'unknown' && heuristicLang !== targetLocale) {
        this.logger.warn({
          msg: 'Translation equals source despite language difference, treating as failure',
          transcriptId,
          detectedLang,
          heuristicLang,
        });
        await this.reconcileResponse(reservation.reservationId, response);
        return null;
      }

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
        sourceLanguage: detectedLang,
        targetLanguage: targetLocale,
        translatedText,
        modelVersion: response.model,
      });

      this.logger.log({
        msg: 'Transcript translated',
        transcriptId,
        from: detectedLang,
        to: targetLocale,
        costUsd: actualCost,
      });

      return {
        translatedText,
        detectedLanguage: detectedLang,
        cached: false,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Transcript translation error',
        transcriptId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      await this.releaseReservation(reservation.reservationId);
      return null;
    }
  }

  /**
   * Heuristic language detection using Turkish-specific characters and common words
   * Returns ISO 639-1 code: 'tr' for Turkish, 'en' for English, or 'unknown'
   */
  private detectLanguageHeuristic(text: string): 'tr' | 'en' | 'unknown' {
    const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
    const hasTurkishChars = turkishChars.test(text);
    
    const lower = text.toLowerCase();
    const turkishMarkers = [
      'deprem', 'yangın', 'yardım', 'enkaz', 'lütfen', 'bilmiyoruz',
      'mahsur', 'kaldık', 'var', 'yok', 'çok', 'için', 'ile', 'bir',
      'şu', 'bu', 'biz', 'siz', 'onlar', 've', 'veya', 'ama', 'kişi',
      'bina', 'çöken', 'katta', 'iki',
    ];
    
    let turkishCount = 0;
    for (const marker of turkishMarkers) {
      if (lower.includes(marker)) turkishCount++;
    }
    
    if (hasTurkishChars || turkishCount >= 3) {
      return 'tr';
    }
    
    const englishMarkers = ['help', 'please', 'emergency', 'building', 'people', 'trapped', 'need'];
    let englishCount = 0;
    for (const marker of englishMarkers) {
      if (lower.includes(marker)) englishCount++;
    }
    
    if (englishCount >= 2) {
      return 'en';
    }
    
    return 'unknown';
  }

  /**
   * When a conservative heuristic is sure the text is already in the operator's language, store the
   * same-language marker and report true so the caller skips the paid model call entirely.
   */
  private async cacheIfConfidentlySameLanguage(
    sourceType: string,
    sourceId: string,
    sourceField: string,
    originalText: string,
    targetLocale: OperatorLocale
  ): Promise<boolean> {
    const confident = detectConfidentLanguage(originalText);
    if (confident !== targetLocale) {
      return false;
    }
    try {
      await this.cacheTranslation({
        sourceType,
        sourceId,
        sourceField,
        sourceLanguage: confident,
        targetLanguage: targetLocale,
        translatedText: originalText,
        modelVersion: 'heuristic',
      });
    } catch (error) {
      // Caching is an optimisation; the verdict is still correct for this request.
      this.logger.warn({ msg: 'Could not cache heuristic same-language verdict', sourceType, sourceId, err: error });
    }
    this.logger.log({ msg: 'Same language by heuristic, model call skipped', sourceType, sourceId, language: confident });
    return true;
  }

  private async reconcileResponse(
    reservationId: string,
    response: {
      model: string;
      requestId: string;
      usage: { inputTokens: number; outputTokens: number };
    }
  ): Promise<void> {
    await this.budgetGuard.reconcile({
      reservationId,
      actualUsd: this.metaClient.computeCost(
        response.model,
        response.usage.inputTokens,
        response.usage.outputTokens
      ),
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      model: response.model,
      requestId: response.requestId,
    });
  }

  private async releaseReservation(reservationId: string): Promise<void> {
    await this.budgetGuard.reconcile({
      reservationId,
      actualUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      model: 'none',
      requestId: 'failed',
    });
  }

  private async getCachedTranslation(
    sourceType: string,
    sourceId: string,
    sourceField: string,
    targetLanguage: string
  ): Promise<{ translatedText: string; sourceLanguage: string } | null> {
    const cached = await this.prisma.aiTranslationCache.findFirst({
      where: {
        sourceType,
        sourceId,
        sourceField,
        targetLanguage,
        modelVersion: { contains: CACHE_VERSION },
      },
      orderBy: { createdAt: 'desc' },
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
    const modelVersion = `${CACHE_VERSION}:${data.modelVersion}`;
    // Upsert: a stale row from an older cache version holds the same unique key and would
    // otherwise make every create fail, forcing a model call on each request.
    await this.prisma.aiTranslationCache.upsert({
      where: {
        sourceType_sourceId_sourceField_targetLanguage: {
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          sourceField: data.sourceField,
          targetLanguage: data.targetLanguage,
        },
      },
      create: {
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        sourceField: data.sourceField,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        translatedText: data.translatedText,
        modelVersion,
      },
      update: {
        sourceLanguage: data.sourceLanguage,
        translatedText: data.translatedText,
        modelVersion,
      },
    });
  }
}
