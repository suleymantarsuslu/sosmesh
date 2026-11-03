/**
 * Operator Demo Controller - Demo/synthetic data creation
 * Work Package D - Demo Seed Support
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AiJobService } from '../ai/ai-job.service';
import { Prisma } from '@prisma/client';

class CreateDemoSosDto {
  messageId!: string;
  sosType!: string;
  locationStatus!: string;
  latitude?: number;
  longitude?: number;
  personCount?: number;
  operatorDisplayText!: string;
  priority!: number;
  synthetic!: boolean;
}

@Controller('v1/operator/demo')
@UseGuards(OperatorAuthGuard)
export class OperatorDemoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiJobs: AiJobService
  ) {}

  @Post('sos')
  @HttpCode(HttpStatus.CREATED)
  async createDemoSos(@Body() dto: CreateDemoSosDto) {
    if (!dto.synthetic) {
      throw new BadRequestException('Demo SOSes must have synthetic=true');
    }

    if (!dto.messageId || !dto.operatorDisplayText) {
      throw new BadRequestException('messageId and operatorDisplayText required');
    }

    const existing = await this.prisma.sosMessage.findUnique({
      where: { messageId: dto.messageId },
    });

    if (existing) {
      return { id: existing.id, messageId: existing.messageId, idempotent: true };
    }

    const incident = await this.prisma.incident.create({
      data: {
        state: 'PENDING',
        sosMessages: {
          create: {
            messageId: dto.messageId,
            sosType: dto.sosType as any,
            locationStatus: dto.locationStatus as any,
            latitude:
              dto.latitude !== undefined
                ? new Prisma.Decimal(dto.latitude)
                : undefined,
            longitude:
              dto.longitude !== undefined
                ? new Prisma.Decimal(dto.longitude)
                : undefined,
            personCount: dto.personCount,
            operatorDisplayText: dto.operatorDisplayText,
            priority: dto.priority,
            synthetic: true,
            needsHumanReview: false,
          },
        },
      },
      include: {
        sosMessages: { take: 1 },
      },
    });

    const sosMessage = incident.sosMessages[0];

    await this.aiJobs.enqueueAfterIngest({
      incidentId: incident.id,
      sosMessageId: sosMessage.id,
    });

    return { id: sosMessage.id, messageId: sosMessage.messageId };
  }
}
