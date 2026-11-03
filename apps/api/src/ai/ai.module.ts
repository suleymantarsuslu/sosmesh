import { Module } from '@nestjs/common';

import { AI_PROVIDER_OVERRIDE, AiJobService } from './ai-job.service';
import {
  ServerKeyPlaintextSource,
  SOS_PLAINTEXT_SOURCE,
} from './sos-plaintext-source';
import { PrismaModule } from '../prisma/prisma.module';
import { MetaModelClient } from './meta-model-client';
import { BudgetGuardService } from './budget-guard.service';
import { AiJobQueueService } from './ai-job-queue.service';
import { AiJobRunnerService } from './ai-job-runner.service';
import { TriageV2Service } from './triage-v2.service';

@Module({
  imports: [PrismaModule],
  providers: [
    AiJobService,
    MetaModelClient,
    BudgetGuardService,
    AiJobQueueService,
    AiJobRunnerService,
    TriageV2Service,
    { provide: AI_PROVIDER_OVERRIDE, useValue: null },
    { provide: SOS_PLAINTEXT_SOURCE, useClass: ServerKeyPlaintextSource },
  ],
  exports: [
    AiJobService,
    MetaModelClient,
    BudgetGuardService,
    AiJobQueueService,
    AiJobRunnerService,
    TriageV2Service,
  ],
})
export class AiModule {}
