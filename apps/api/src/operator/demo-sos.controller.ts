/**
 * Demo SOS Controller - Create synthetic SOS for testing
 * Work Package B - Voice Rescue
 * 
 * POST /v1/operator/demo/sos - create synthetic test incident
 */

import { Controller, Post, Body, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CreateDemoSosDto = {
  displayText: string;
  sosType?: 'GENERAL' | 'MEDICAL' | 'TRAPPED' | 'FIRE' | 'OTHER';
  priority?: number;
  personCount?: number;
  synthetic?: boolean;
};

@Controller('v1/operator/demo')
export class DemoSosController {
  private readonly logger = new Logger(DemoSosController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('sos')
  async createDemoSos(@Body() dto: CreateDemoSosDto) {
    const incident = await this.prisma.incident.create({
      data: {
        state: 'PENDING',
        reviewStatus: 'NEW',
      },
    });

    const sosMessage = await this.prisma.sosMessage.create({
      data: {
        messageId: `demo-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        incidentId: incident.id,
        sosType: dto.sosType ?? 'GENERAL',
        priority: dto.priority ?? 3,
        personCount: dto.personCount ?? null,
        operatorDisplayText: dto.displayText,
        synthetic: dto.synthetic ?? true,
        deliveryState: 'SERVER_ACCEPTED',
        locationStatus: 'UNKNOWN',
      },
    });

    await this.prisma.messageEvent.create({
      data: {
        sosMessageId: sosMessage.id,
        deliveryState: 'SERVER_ACCEPTED',
        source: 'demo-api',
      },
    });

    this.logger.log({
      msg: 'Demo SOS created',
      incidentId: incident.id,
      messageId: sosMessage.messageId,
    });

    return {
      incidentId: incident.id,
      sosMessageId: sosMessage.id,
      messageId: sosMessage.messageId,
    };
  }
}
