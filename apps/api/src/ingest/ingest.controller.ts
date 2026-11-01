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

import { IngestRequestDto, IngestResponseDto } from './dto/ingest-request.dto';
import { IngestService } from './ingest.service';

@ApiTags('public')
@Controller('v1')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept SOS packet from internet-connected relay' })
  @ApiResponse({ status: 200, description: 'SERVER_ACCEPTED signed receipt' })
  async ingest(
    @Body() body: IngestRequestDto,
    @Req() req: Request
  ): Promise<IngestResponseDto> {
    const clientKey = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const rawBodyBytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
    return this.ingestService.processIngest(body, clientKey, rawBodyBytes);
  }
}
