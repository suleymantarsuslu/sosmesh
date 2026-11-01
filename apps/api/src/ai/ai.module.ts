import { Module } from '@nestjs/common';

import { AI_PROVIDER_OVERRIDE, AiJobService } from './ai-job.service';
import {
  NullSosPlaintextSource,
  SOS_PLAINTEXT_SOURCE,
} from './sos-plaintext-source';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    AiJobService,
    { provide: AI_PROVIDER_OVERRIDE, useValue: null },
    { provide: SOS_PLAINTEXT_SOURCE, useClass: NullSosPlaintextSource },
  ],
  exports: [AiJobService],
})
export class AiModule {}
