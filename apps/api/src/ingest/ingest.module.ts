import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { EventsModule } from '../events/events.module';
import { MediaModule } from '../media/media.module';
import { IngestController } from './ingest.controller';
import { IngestPacketService } from './ingest-packet.service';
import { IngestRateLimitService } from './ingest-rate-limit.service';
import { IngestService } from './ingest.service';
import { ReceiptSignerService } from './receipt-signer.service';
import { MeshV2IngestService } from '../mesh-v2/mesh-v2-ingest.service';
import { ReceiptsLookupController } from '../mesh-v2/receipts-lookup.controller';
import { ReceiptsLookupService } from '../mesh-v2/receipts-lookup.service';

@Module({
  imports: [AiModule, EventsModule, MediaModule],
  controllers: [IngestController, ReceiptsLookupController],
  providers: [
    IngestService,
    IngestPacketService,
    IngestRateLimitService,
    ReceiptSignerService,
    MeshV2IngestService,
    ReceiptsLookupService,
  ],
  exports: [IngestService, IngestPacketService, IngestRateLimitService],
})
export class IngestModule {}
