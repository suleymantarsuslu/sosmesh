import { Module } from '@nestjs/common';

import { AI_PROVIDER_OVERRIDE, AiJobService } from './ai-job.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    AiJobService,
    { provide: AI_PROVIDER_OVERRIDE, useValue: null },
  ],
  exports: [AiJobService],
})
export class AiModule {}
