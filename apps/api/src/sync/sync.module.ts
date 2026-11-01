import { Module } from '@nestjs/common';

import { IngestModule } from '../ingest/ingest.module';
import { BatchIngestController } from './batch-ingest.controller';
import { BatchIngestService } from './batch-ingest.service';

@Module({
  imports: [IngestModule],
  controllers: [BatchIngestController],
  providers: [BatchIngestService],
})
export class SyncModule {}
