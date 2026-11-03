import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import {
  IngestBatchRequestDto,
  IngestBatchResponseDto,
} from './dto/ingest-batch.dto';
import { BatchIngestService } from './batch-ingest.service';
import { getClientKey } from '../common/utils/client-ip.util';

@ApiTags('public')
@Controller('v1/ingest')
export class BatchIngestController {
  constructor(private readonly batchIngest: BatchIngestService) {}

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch SOS ingest (per-item idempotent semantics)' })
  @ApiResponse({ status: 200, description: 'Per-item receipts or errors' })
  async ingestBatch(
    @Body() body: IngestBatchRequestDto,
    @Req() req: Request
  ): Promise<IngestBatchResponseDto> {
    const clientKey = getClientKey(req);
    return this.batchIngest.processBatch(body, clientKey);
  }
}
