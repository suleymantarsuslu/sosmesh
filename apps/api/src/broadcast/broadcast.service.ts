import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastSignerService } from './broadcast-signer.service';
import { PushNotificationService } from './push-notification.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { BroadcastHistoryDto, BroadcastResponseDto } from './dto/broadcast-response.dto';
import { StructuredEventLogger } from '../observability/structured-event-logger.service';
import { RegionsService } from './regions.service';
import { Subject } from 'rxjs';

@Injectable()
export class BroadcastService {
  private readonly broadcastStream = new Subject<BroadcastResponseDto>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: BroadcastSignerService,
    private readonly logger: StructuredEventLogger,
    private readonly regionsService: RegionsService,
    private readonly pushService: PushNotificationService
  ) {}

  getBroadcastStream() {
    return this.broadcastStream.asObservable();
  }

  async create(userId: string, dto: CreateBroadcastDto): Promise<BroadcastResponseDto> {
    let regionLatitude: number | undefined = dto.regionLatitude;
    let regionLongitude: number | undefined = dto.regionLongitude;
    let regionRadiusKm: number | undefined = dto.regionRadiusKm;
    let regionLabel: string | undefined = undefined;

    if (dto.selectedRegion) {
      const selected = dto.selectedRegion;
      regionLatitude = Number(selected.lat.toFixed(7));
      regionLongitude = Number(selected.lon.toFixed(7));
      regionRadiusKm = this.regionsService.computeRadiusKm(selected.boundingBox);
      regionLabel = selected.label;
    }

    const hasRegion = regionLatitude != null && regionLongitude != null && regionRadiusKm != null;
    if ((regionLatitude != null || regionLongitude != null || regionRadiusKm != null) && !hasRegion) {
      throw new BadRequestException('All region fields (latitude, longitude, radiusKm) must be provided together or omitted');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + dto.expiryHours * 60 * 60 * 1000);

    if (regionLatitude != null) {
      regionLatitude = Number(regionLatitude.toFixed(7));
    }
    if (regionLongitude != null) {
      regionLongitude = Number(regionLongitude.toFixed(7));
    }
    // Postgres float8 output drops the last digits of a full-precision double, so the
    // radius read back by devices would differ from the signed value. Round before signing.
    if (regionRadiusKm != null) {
      regionRadiusKm = Number(regionRadiusKm.toFixed(3));
    }

    const id = crypto.randomUUID();
    const signature = this.signer.signBroadcast(
      id,
      dto.title,
      dto.body,
      dto.severity,
      now,
      expiresAt,
      regionLatitude,
      regionLongitude,
      regionRadiusKm
    );

    const broadcast = await this.prisma.broadcastNotification.create({
      data: {
        id,
        title: dto.title,
        body: dto.body,
        severity: dto.severity,
        createdById: userId,
        createdAt: now,
        expiresAt,
        regionLatitude,
        regionLongitude,
        regionRadiusKm,
        regionLabel,
        signature,
      },
    });

    this.logger.emit('broadcast_created', {
      broadcastId: id,
      userId,
      severity: dto.severity,
      hasRegion,
      expiryHours: dto.expiryHours,
    });

    const dto_response = this.toDto(broadcast);
    this.broadcastStream.next(dto_response);

    setImmediate(() => {
      this.pushService.sendBroadcastNotifications({
        broadcastId: id,
        title: dto.title,
        body: dto.body,
        severity: dto.severity,
      }).catch(() => {});
    });

    return dto_response;
  }

  async listActive(sinceCursor: Date): Promise<BroadcastResponseDto[]> {
    const now = new Date();
    const broadcasts = await this.prisma.broadcastNotification.findMany({
      where: {
        expiresAt: { gt: now },
        createdAt: { gt: sinceCursor },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return broadcasts.map((b) => this.toDto(b));
  }

  async listHistory(limit: number): Promise<BroadcastHistoryDto[]> {
    const broadcasts = await this.prisma.broadcastNotification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        createdBy: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    return broadcasts.map((b) => ({
      id: b.id,
      title: b.title,
      severity: b.severity,
      createdBy: b.createdBy.displayName || b.createdBy.email,
      createdAt: b.createdAt.toISOString(),
      expiresAt: b.expiresAt.toISOString(),
      hasRegion: b.regionLatitude != null && b.regionLongitude != null,
      regionLabel: b.regionLabel ?? undefined,
      deliveredCount: b.deliveredCount,
      meshRelayCount: b.meshRelayCount,
    }));
  }

  async incrementDeliveryCount(id: string): Promise<void> {
    await this.prisma.broadcastNotification.update({
      where: { id },
      data: { deliveredCount: { increment: 1 } },
    });
  }

  async incrementMeshRelayCount(id: string): Promise<void> {
    await this.prisma.broadcastNotification.update({
      where: { id },
      data: { meshRelayCount: { increment: 1 } },
    });
  }

  private toDto(
    broadcast: {
      id: string;
      title: string;
      body: string;
      severity: string;
      createdAt: Date;
      expiresAt: Date;
      regionLatitude: Prisma.Decimal | null;
      regionLongitude: Prisma.Decimal | null;
      regionRadiusKm: number | null;
      signature: string;
      deliveredCount: number;
      meshRelayCount: number;
    }
  ): BroadcastResponseDto {
    return {
      id: broadcast.id,
      title: broadcast.title,
      body: broadcast.body,
      severity: broadcast.severity,
      createdAt: broadcast.createdAt.toISOString(),
      expiresAt: broadcast.expiresAt.toISOString(),
      regionLatitude: broadcast.regionLatitude ? broadcast.regionLatitude.toNumber() : null,
      regionLongitude: broadcast.regionLongitude ? broadcast.regionLongitude.toNumber() : null,
      regionRadiusKm: broadcast.regionRadiusKm,
      signature: broadcast.signature,
      deliveredCount: broadcast.deliveredCount,
      meshRelayCount: broadcast.meshRelayCount,
    };
  }
}
