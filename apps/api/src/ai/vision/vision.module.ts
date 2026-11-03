/**
 * Vision Module
 * Work Package C - Vision
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PhotoValidatorService } from './photo-validator.service';
import { VisionAnalysisService } from './vision-analysis.service';
import { MetaModelClient } from '../meta-model-client';
import { BudgetGuardService } from '../budget-guard.service';

@Module({
  imports: [PrismaModule],
  providers: [
    PhotoValidatorService,
    VisionAnalysisService,
    MetaModelClient,
    BudgetGuardService,
  ],
  exports: [PhotoValidatorService, VisionAnalysisService],
})
export class VisionModule {}
