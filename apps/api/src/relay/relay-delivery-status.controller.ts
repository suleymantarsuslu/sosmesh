import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { RelayDeliveryStatusRequestDto, RelayDeliveryStatusResponseDto } from './relay-delivery-status.dto';
import { RelayDeliveryStatusService } from './relay-delivery-status.service';

@ApiTags('device')
@Controller('v1/device/relay')
export class RelayDeliveryStatusController {
  constructor(
    private readonly deliveryStatusService: RelayDeliveryStatusService,
  ) {}

  @Post('delivery-status')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Check delivery status of carried relay messages',
    description: 'Returns which of the provided message IDs have been successfully ingested by the server',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery status checked successfully',
    type: RelayDeliveryStatusResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (e.g., too many message IDs)',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limited',
  })
  async checkDeliveryStatus(
    @Body() body: RelayDeliveryStatusRequestDto,
    @Req() req: Request,
  ): Promise<RelayDeliveryStatusResponseDto> {
    return this.deliveryStatusService.checkDeliveryStatus(body.messageIds);
  }
}
