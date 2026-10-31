import { Module } from '@nestjs/common';

import { IngestController } from './ingest.controller';
import { IngestPacketService } from './ingest-packet.service';
import { IngestRateLimitService } from './ingest-rate-limit.service';
import { IngestService } from './ingest.service';
import { ReceiptSignerService } from './receipt-signer.service';

@Module({
  controllers: [IngestController],
  providers: [
    IngestService,
    IngestPacketService,
    IngestRateLimitService,
    ReceiptSignerService,
  ],
})
export class IngestModule {}
