import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { IngestRequestDto, IngestResponseDto } from './dto/ingest-request.dto';
import { IngestService } from './ingest.service';
import { getClientKey } from '../common/utils/client-ip.util';
import { SenderRateLimitedException } from '../mesh-v2/sender-rate-limit';

@ApiTags('public')
@Controller('v1')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept SOS packet from internet-connected relay' })
  @ApiResponse({ status: 200, description: 'SERVER_ACCEPTED signed receipt' })
  @ApiResponse({ status: 429, description: 'Rate limited; mesh v2 per-sender limit sets Retry-After (seconds)' })
  async ingest(
    @Body() body: IngestRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<IngestResponseDto> {
    const clientKey = getClientKey(req);
    const rawBodyBytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
    try {
      return await this.ingestService.processIngest(body, clientKey, rawBodyBytes);
    } catch (error) {
      if (error instanceof SenderRateLimitedException) {
        res.setHeader('Retry-After', String(error.retryAfterSeconds));
      }
      throw error;
    }
  }
}
