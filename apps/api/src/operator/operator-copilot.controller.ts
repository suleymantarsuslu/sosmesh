/**
 * Operator Copilot Controller - Mission Copilot endpoints
 * Work Package D - Mission Copilot
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { OperatorCsrfGuard } from './guards/operator-csrf.guard';
import {
  CopilotService,
  type CopilotAskRequest,
  type CopilotAskResponse,
  type SituationSummary,
} from '../ai/copilot/copilot.service';

class AskCopilotDto {
  question!: string;
  scope!: 'open' | { incidentIds: string[] };
}

@Controller('v1/operator')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard)
export class OperatorCopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Post('copilot/ask')
  @HttpCode(HttpStatus.OK)
  async ask(@Body() dto: AskCopilotDto): Promise<CopilotAskResponse> {
    if (!dto.question || typeof dto.question !== 'string') {
      throw new BadRequestException('Invalid question');
    }

    if (!dto.scope) {
      throw new BadRequestException('Missing scope');
    }

    if (
      dto.scope !== 'open' &&
      (!Array.isArray((dto.scope as any).incidentIds) ||
        (dto.scope as any).incidentIds.length === 0)
    ) {
      throw new BadRequestException('Invalid scope');
    }

    const request: CopilotAskRequest = {
      question: dto.question,
      scope: dto.scope,
    };

    return this.copilot.ask(request);
  }

  @Get('ai/situation-summary')
  async getSituationSummary(): Promise<SituationSummary> {
    return this.copilot.getSituationSummary();
  }
}
