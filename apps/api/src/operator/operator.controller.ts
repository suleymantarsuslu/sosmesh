import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { buildPaginated, parsePagination } from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperatorMessageDto } from './dto/create-operator-message.dto';
import { OperatorAuthGuard } from './guards/operator-auth.guard';

@ApiTags('operator')
@ApiBearerAuth()
@Controller('v1/operator')
@UseGuards(OperatorAuthGuard)
export class OperatorController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('incidents')
  async listIncidents(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    const pagination = parsePagination({
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
    const rows = await this.prisma.incident.findMany({
      take: pagination.limit + 1,
      ...(pagination.cursor
        ? { skip: 1, cursor: { id: pagination.cursor } }
        : {}),
      orderBy: { createdAt: 'desc' },
    });
    return buildPaginated(rows, pagination.limit);
  }

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
