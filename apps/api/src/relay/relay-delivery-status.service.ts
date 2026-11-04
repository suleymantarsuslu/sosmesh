import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RelayDeliveryStatusResponseDto } from './relay-delivery-status.dto';

@Injectable()
export class RelayDeliveryStatusService {
  private readonly logger = new Logger(RelayDeliveryStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkDeliveryStatus(messageIds: string[]): Promise<RelayDeliveryStatusResponseDto> {
    if (messageIds.length === 0) {
      return { delivered: [] };
    }

    const uniqueIds = [...new Set(messageIds)];

    const deliveredMessages = await this.prisma.sosMessage.findMany({
      where: {
        messageId: {
          in: uniqueIds,
        },
      },
      select: {
        messageId: true,
      },
    });

    return {
      delivered: deliveredMessages.map((msg) => msg.messageId),
    };
  }
}
