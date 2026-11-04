import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecommendationFeedbackRating, UserRole } from '@prisma/client';

import { OperatorAuthGuard, OperatorRequest } from '../operator/guards/operator-auth.guard';
import { OperatorCsrfGuard } from '../operator/guards/operator-csrf.guard';
import { RolesGuard } from '../operator/guards/roles.guard';
import { Roles } from '../operator/guards/roles.decorator';
import { RecommendationService } from './recommendation.service';

@ApiTags('operator-recommendations')
@ApiBearerAuth()
@Controller('v1/operator')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard, RolesGuard)
export class RecommendationController {
  constructor(private readonly recommendations: RecommendationService) {}

  @Post('incidents/:incidentId/recommendations/plan')
  plan(
    @Req() req: OperatorRequest,
    @Param('incidentId') incidentId: string,
    @Query('includeAiRationale') includeAiRationale?: string
  ) {
    return this.recommendations.planRecommendations(req.operatorUser, incidentId, {
      includeAiRationale: includeAiRationale === 'true',
    });
  }

  @Get('incidents/:incidentId/recommendations')
  list(@Req() req: OperatorRequest, @Param('incidentId') incidentId: string) {
    return this.recommendations.listRecommendations(req.operatorUser, incidentId);
  }

  @Patch('recommendations/:recommendationId/reject')
  reject(@Req() req: OperatorRequest, @Param('recommendationId') recommendationId: string) {
    return this.recommendations.rejectRecommendation(req.operatorUser, recommendationId);
  }

  @Post('recommendations/:recommendationId/confirm')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  confirm(
    @Req() req: OperatorRequest,
    @Param('recommendationId') recommendationId: string,
    @Body() body: { teamId?: string; assigneeId?: string }
  ) {
    return this.recommendations.confirmRecommendation(req.operatorUser, recommendationId, body);
  }

  @Post('recommendations/:recommendationId/feedback')
  feedback(
    @Req() req: OperatorRequest,
    @Param('recommendationId') recommendationId: string,
    @Body()
    body: {
      rating: RecommendationFeedbackRating;
      note?: string;
    }
  ) {
    return this.recommendations.recordFeedback(req.operatorUser, recommendationId, body);
  }
}
