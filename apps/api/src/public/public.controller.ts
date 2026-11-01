import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service';

@ApiTags('public')
@Controller('v1/public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('messages/:messageId/status')
  async messageStatus(@Param('messageId') messageId: string) {
    const message = await this.prisma.sosMessage.findUnique({
      where: { messageId },
      select: {
        messageId: true,
        deliveryState: true,
        locationStatus: true,
        receivedAt: true,
      },
    });
    if (!message) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Message not found',
      });
    }
    return message;
  }
}
