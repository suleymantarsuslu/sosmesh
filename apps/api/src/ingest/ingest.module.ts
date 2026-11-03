import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { EventsModule } from '../events/events.module';
import { MediaModule } from '../media/media.module';
import { IngestController } from './ingest.controller';
import { IngestPacketService } from './ingest-packet.service';
import { IngestRateLimitService } from './ingest-rate-limit.service';
import { IngestService } from './ingest.service';
import { ReceiptSignerService } from './receipt-signer.service';

@Module({
  imports: [AiModule, EventsModule, MediaModule],
  controllers: [IngestController],
  providers: [
    IngestService,
    IngestPacketService,
    IngestRateLimitService,
    ReceiptSignerService,
  ],
  exports: [IngestService, IngestPacketService],
})
export class IngestModule {}
