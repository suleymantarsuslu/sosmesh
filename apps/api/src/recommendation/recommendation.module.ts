import { Module } from '@nestjs/common';

import { CoordinationModule } from '../coordination/coordination.module';
import { OrganizationModule } from '../organization/organization.module';
import { RecommendationController } from './recommendation.controller';
import { RecommendationRationaleService } from './recommendation-rationale.service';
import { RecommendationService } from './recommendation.service';

@Module({
  imports: [OrganizationModule, CoordinationModule],
  controllers: [RecommendationController],
  providers: [RecommendationService, RecommendationRationaleService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
