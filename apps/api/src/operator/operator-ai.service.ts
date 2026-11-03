/**
 * Operator AI Service - AI status and case AI data
 * Work Package A - AI Foundation
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaModelClient } from '../ai/meta-model-client';
import { BudgetGuardService } from '../ai/budget-guard.service';
import { AiJobQueueService } from '../ai/ai-job-queue.service';
import { LocaleContentService, type OperatorLocale } from '../ai/locale-content.service';
import type { AiStatusView } from '../ai/contracts/ai-status-view';
import type { AiTriageView, UrgencySuggestion } from '../ai/contracts/ai-triage-view';

@Injectable()
export class OperatorAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaClient: MetaModelClient,
    private readonly budgetGuard: BudgetGuardService,
    private readonly aiJobQueue: AiJobQueueService,
    private readonly localeContent: LocaleContentService
  ) {}

  async getStatus(): Promise<AiStatusView> {
    const enabled = process.env.AI_ENABLED === 'true';
    const hasApiKey = !!process.env.MODEL_API_KEY;

    if (!enabled || !hasApiKey) {
      return {
        enabled: false,
        circuitState: 'open',
        budgetUsedToday: 0,
        budgetTotalLimit: 0,
        budgetDailyLimit: 0,
        lastAnalysisAt: null,
        queueDepth: 0,
        modelsAvailable: {
          spark: false,
          asr: false,
          sam: false,
        },
      };
    }

    const [usage, queueDepth, lastAnalysis] = await Promise.all([
      this.budgetGuard.getUsage(),
      this.aiJobQueue.getQueueDepth(),
      this.getLastAnalysisTime(),
    ]);

    const circuitState = this.metaClient.getCircuitState();

    return {
      enabled: true,
      circuitState,
      budgetUsedToday: usage.dailyUsed,
      budgetTotalLimit: usage.totalLimit,
      budgetDailyLimit: usage.dailyLimit,
      lastAnalysisAt: lastAnalysis,
      queueDepth,
      modelsAvailable: {
        spark: hasApiKey,
        asr: hasApiKey,
        sam: hasApiKey,
      },
    };
  }

  async getCaseAi(incidentId: string, locale: OperatorLocale = 'tr'): Promise<AiTriageView | null> {
    const analysis = await this.prisma.aiAnalysis.findFirst({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });

    if (!analysis) {
      return null;
    }

    return {
      status: this.mapStatus(analysis.status),
      modelVersion: analysis.modelVersion,
      eventType: analysis.eventType,
      reportedPersonCount: analysis.reportedPersonCount,
      needs: this.parseJsonArray(analysis.needs) as string[],
      hazards: this.parseJsonArray(analysis.hazards) as string[],
      urgencySuggestion: analysis.urgencySuggestion as UrgencySuggestion | null,
      missingInfo: this.parseJsonArray(analysis.missingInfo) as string[],
      summary: this.localeContent.extractText(analysis.summary, locale, null),
      nextStepSuggestion: this.localeContent.extractText(analysis.nextStepSuggestion, locale, null),
      sourceQuotes: this.parseJsonArray(analysis.sourceQuotes).map((q: unknown) => {
        if (typeof q === 'object' && q !== null && 'text' in q) {
          return q as { text: string; field?: string };
        }
        return { text: String(q) };
      }),
      translation: this.parseJsonValue(analysis.translation) as AiTriageView['translation'],
      followUpQuestions: this.parseJsonArray(analysis.followUpQuestions).map((q: unknown) =>
        String(q)
      ),
      operatorOverride: this.parseJsonValue(analysis.operatorOverride) as AiTriageView['operatorOverride'],
      analyzedAt: analysis.createdAt.toISOString(),
    };
  }

  private async getLastAnalysisTime(): Promise<string | null> {
    const last = await this.prisma.aiAnalysis.findFirst({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return last ? last.createdAt.toISOString() : null;
  }

  private mapStatus(status: string): AiTriageView['status'] {
    const map: Record<string, AiTriageView['status']> = {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'completed',
      FAILED: 'failed',
      REQUIRES_REVIEW: 'requires_review',
      UNAVAILABLE: 'unavailable',
      NO_PLAINTEXT: 'unavailable',
    };

    return map[status] ?? 'pending';
  }

  private parseJsonArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  }

  private parseJsonValue(value: unknown): unknown {
    return value ?? null;
  }
}
