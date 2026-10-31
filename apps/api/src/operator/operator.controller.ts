import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service';
import { CreateOperatorMessageDto } from './dto/create-operator-message.dto';
import { OperatorAuthGuard } from './guards/operator-auth.guard';

@ApiTags('operator')
@ApiBearerAuth()
@Controller('v1/operator')
@UseGuards(OperatorAuthGuard)
export class OperatorController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  async createMessage(@Body() dto: CreateOperatorMessageDto) {
    const created = await this.prisma.sosMessage.create({
      data: {
        messageId: dto.messageId,
        incidentId: dto.incidentId,
        sosType: dto.sosType,
        locationStatus: dto.locationStatus,
        priority: dto.priority,
        personCount: dto.personCount,
        encryptedNoteBlob: dto.encryptedNoteBlob,
      },
    });
    return { id: created.id, messageId: created.messageId };
  }
}
