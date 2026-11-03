/**
 * Operator AI Controller - AI status and case AI data endpoints
 * Work Package A - AI Foundation
 */

import { Controller, Get, Headers, Param, Query, UseGuards } from '@nestjs/common';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { OperatorAiService } from './operator-ai.service';
import { LocaleContentService } from '../ai/locale-content.service';
import type { AiStatusView } from '../ai/contracts/ai-status-view';
import type { AiTriageView } from '../ai/contracts/ai-triage-view';

@Controller('v1/operator/ai')
@UseGuards(OperatorAuthGuard)
export class OperatorAiController {
  constructor(private readonly aiService: OperatorAiService) {}

  @Get('status')
  async getAiStatus(): Promise<AiStatusView> {
    return this.aiService.getStatus();
  }
}

@Controller('v1/operator/cases/:incidentId/ai')
@UseGuards(OperatorAuthGuard)
export class OperatorCaseAiController {
  constructor(
    private readonly aiService: OperatorAiService,
    private readonly localeContent: LocaleContentService
  ) {}

  @Get()
  async getCaseAi(
    @Param('incidentId') incidentId: string,
    @Query('locale') localeParam?: string,
    @Headers('accept-language') acceptLanguage?: string
  ): Promise<AiTriageView | null> {
    const locale = this.localeContent.resolveLocale(localeParam, acceptLanguage);
    return this.aiService.getCaseAi(incidentId, locale);
  }
}
