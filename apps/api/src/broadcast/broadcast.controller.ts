import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OperatorAuthGuard, type OperatorRequest } from '../operator/guards/operator-auth.guard';
import { Roles } from '../operator/guards/roles.decorator';
import { RolesGuard } from '../operator/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { BroadcastService } from './broadcast.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { BroadcastHistoryDto, BroadcastResponseDto } from './dto/broadcast-response.dto';
import { StructuredEventLoggerService } from '../observability/structured-event-logger.service';

@Controller('operator/broadcasts')
@UseGuards(OperatorAuthGuard, RolesGuard)
export class BroadcastController {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly logger: StructuredEventLoggerService
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: OperatorRequest,
    @Body() dto: CreateBroadcastDto
  ): Promise<BroadcastResponseDto> {
    const userId = req.operatorUser!.userId;
    this.logger.auditLog(userId, 'BROADCAST_CREATE', {
      title: dto.title,
      severity: dto.severity,
      hasRegion: dto.regionLatitude != null,
    });
    return this.broadcastService.create(userId, dto);
  }

  @Get('history')
  @Roles(UserRole.ADMIN)
  async history(
    @Query('limit') limit?: string
  ): Promise<BroadcastHistoryDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.broadcastService.listHistory(Math.min(parsedLimit, 100));
  }
}

@Controller('device/broadcasts')
export class DeviceBroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get('active')
  async listActive(
    @Query('since') since?: string
  ): Promise<BroadcastResponseDto[]> {
    const sinceCursor = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.broadcastService.listActive(sinceCursor);
  }
}
