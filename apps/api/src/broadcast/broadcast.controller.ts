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
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { OperatorAuthGuard, type OperatorRequest } from '../operator/guards/operator-auth.guard';
import { Roles } from '../operator/guards/roles.decorator';
import { RolesGuard } from '../operator/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { BroadcastService } from './broadcast.service';
import { BroadcastSignerService } from './broadcast-signer.service';
import { PushNotificationService } from './push-notification.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { BroadcastHistoryDto, BroadcastResponseDto } from './dto/broadcast-response.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { StructuredEventLogger } from '../observability/structured-event-logger.service';

@Controller('v1/operator/broadcasts')
@UseGuards(OperatorAuthGuard, RolesGuard)
export class BroadcastController {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly logger: StructuredEventLogger
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: OperatorRequest,
    @Body() dto: CreateBroadcastDto
  ): Promise<BroadcastResponseDto> {
    const userId = req.operatorUser.sub;
    this.logger.emit('broadcast_create_requested', {
      userId,
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

  @Sse('stream')
  @Roles(UserRole.ADMIN)
  stream(): Observable<MessageEvent> {
    return this.broadcastService.getBroadcastStream().pipe(
      map((broadcast) => ({
        data: broadcast,
      })),
    );
  }
}

@Controller('v1/device/broadcasts')
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

@Controller('v1/device/push-tokens')
export class DevicePushTokenController {
  constructor(private readonly pushService: PushNotificationService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@Body() dto: RegisterPushTokenDto): Promise<void> {
    await this.pushService.registerToken(dto.platform as any, dto.token, dto.deviceId);
  }
}

@Controller('v1/device/broadcasts/public-key')
export class DeviceBroadcastPublicKeyController {
  constructor(private readonly signer: BroadcastSignerService) {}

  @Get()
  getPublicKey(): { publicKey: string } {
    return { publicKey: this.signer.getPublicKeyBase64() };
  }
}
