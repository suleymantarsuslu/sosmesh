import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { getClientKey } from '../common/utils/client-ip.util';
import { IngestRateLimitService } from '../ingest/ingest-rate-limit.service';
import { parseLookupRequest, ReceiptsLookupService, type DeliveryTombstone } from './receipts-lookup.service';

@ApiTags('public')
@Controller('v1/receipts')
export class ReceiptsLookupController {
  constructor(
    private readonly lookupService: ReceiptsLookupService,
    private readonly rateLimit: IngestRateLimitService
  ) {}

  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mesh v2: return existing signed receipts for known (messageId, packetHash) pairs' })
  @ApiResponse({ status: 200, description: 'Receipts (delivery tombstones) for matching items only' })
  async lookup(@Body() body: unknown, @Req() req: Request): Promise<{ receipts: DeliveryTombstone[] }> {
    this.rateLimit.assertAllowed(getClientKey(req));
    return this.lookupService.lookup(parseLookupRequest(body));
  }
}
