import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OperatorReviewStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsObject, IsOptional, Min, ValidateIf } from 'class-validator';

import { LocaleContentService } from '../ai/locale-content.service';
import { OperatorAuthGuard, OperatorRequest } from '../operator/guards/operator-auth.guard';
import { OperatorCsrfGuard } from '../operator/guards/operator-csrf.guard';
import { RolesGuard } from '../operator/guards/roles.guard';
import { OperatorCaseActionsService } from '../operator/operator-case-actions.service';
import { OperatorCasesService } from '../operator/operator-cases.service';

class ReviewStatusDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsEnum(OperatorReviewStatus)
  reviewStatus!: OperatorReviewStatus;
}

class MetadataCorrectionDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  personCount?: number | null;

  @IsOptional()
  @IsEnum(['UNKNOWN', 'GPS', 'MANUAL'])
  locationStatus?: 'UNKNOWN' | 'GPS' | 'MANUAL';

  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  longitude?: number | null;
}

class AiOverrideDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsObject()
  override!: Record<string, unknown>;
}

@ApiTags('operator')
@ApiBearerAuth()
@Controller('v1/operator/cases')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard, RolesGuard)
export class OperatorCaseEventsController {
  constructor(
    private readonly actions: OperatorCaseActionsService,
    private readonly cases: OperatorCasesService,
    private readonly localeContent: LocaleContentService
  ) {}

  @Get(':incidentId/detail')
  async getDetail(
    @Req() req: OperatorRequest,
    @Param('incidentId') incidentId: string,
    @Query('locale') localeParam?: string,
    @Headers('accept-language') acceptLanguage?: string
  ) {
    const locale = this.localeContent.resolveLocale(localeParam, acceptLanguage);
    const detail = await this.cases.getCaseDetail(req.operatorUser, incidentId, locale);
    if (!detail) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }
    const audit = await this.actions.listAudit(req.operatorUser, incidentId);
    return { ...detail, audit };
  }

  @Post(':incidentId/seen')
  async postSeen(@Req() req: OperatorRequest, @Param('incidentId') incidentId: string) {
    return this.actions.recordOperatorSeen(req.operatorUser, incidentId);
  }

  @Patch(':incidentId/review-status')
  async patchReviewStatus(
    @Req() req: OperatorRequest,
    @Param('incidentId') incidentId: string,
    @Body() body: ReviewStatusDto
  ) {
    return this.actions.transitionReviewStatus(
      req.operatorUser,
      incidentId,
      body.reviewStatus,
      body.expectedVersion
    );
  }

  @Post(':incidentId/corrections')
  async postCorrection(
    @Req() req: OperatorRequest,
    @Param('incidentId') incidentId: string,
    @Body() body: MetadataCorrectionDto
  ) {
    return this.actions.applyMetadataCorrection(req.operatorUser, incidentId, body);
  }

  @Post(':incidentId/ai-override')
  async postAiOverride(
    @Req() req: OperatorRequest,
    @Param('incidentId') incidentId: string,
    @Body() body: AiOverrideDto
  ) {
    return this.actions.applyAiOverride(req.operatorUser, incidentId, body);
  }

  @Get(':incidentId/audit')
  async getAudit(@Req() req: OperatorRequest, @Param('incidentId') incidentId: string) {
    return { items: await this.actions.listAudit(req.operatorUser, incidentId) };
  }

  @Post(':incidentId/delete')
  async deleteIncident(@Req() req: OperatorRequest, @Param('incidentId') incidentId: string) {
    return this.actions.deleteIncident(req.operatorUser, incidentId);
  }
}
