/**
 * Operator Fusion Controller - Link suggestion endpoints
 * Work Package D - Signal Fusion
 */

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OperatorAuthGuard, type OperatorRequest } from './guards/operator-auth.guard';
import { OperatorCsrfGuard } from './guards/operator-csrf.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { IncidentLinkSuggestionView } from '../ai/contracts/link-suggestion-view';

@Controller('v1/operator')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard)
export class OperatorFusionController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('link-suggestions/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmLinkSuggestion(
    @Param('id') suggestionId: string,
    @Req() req: OperatorRequest
  ): Promise<{ status: string }> {
    const user = req.operatorUser;
    const suggestion = await this.prisma.incidentLinkSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      throw new NotFoundException('Link suggestion not found');
    }

    if (suggestion.status !== 'suggested') {
      throw new BadRequestException('Link suggestion already decided');
    }

    await this.prisma.incidentLinkSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'confirmed',
        decidedByUserId: user.id,
        decidedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'link_suggestion_confirmed',
        userId: user.id,
        entityType: 'incident_link_suggestion',
        entityId: suggestionId,
        metadataJson: {
          incidentAId: suggestion.incidentAId,
          incidentBId: suggestion.incidentBId,
        },
      },
    });

    return { status: 'confirmed' };
  }

  @Post('link-suggestions/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectLinkSuggestion(
    @Param('id') suggestionId: string,
    @Req() req: OperatorRequest
  ): Promise<{ status: string }> {
    const user = req.operatorUser;
    const suggestion = await this.prisma.incidentLinkSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      throw new NotFoundException('Link suggestion not found');
    }

    if (suggestion.status !== 'suggested') {
      throw new BadRequestException('Link suggestion already decided');
    }

    await this.prisma.incidentLinkSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'rejected',
        decidedByUserId: user.id,
        decidedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'link_suggestion_rejected',
        userId: user.id,
        entityType: 'incident_link_suggestion',
        entityId: suggestionId,
        metadataJson: {
          incidentAId: suggestion.incidentAId,
          incidentBId: suggestion.incidentBId,
        },
      },
    });

    return { status: 'rejected' };
  }

  @Get('cases/:incidentId/links')
  async getCaseLinks(
    @Param('incidentId') incidentId: string
  ): Promise<IncidentLinkSuggestionView[]> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const suggestions = await this.prisma.incidentLinkSuggestion.findMany({
      where: {
        OR: [{ incidentAId: incidentId }, { incidentBId: incidentId }],
      },
      include: {
        decidedBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return suggestions.map((s) => ({
      id: s.id,
      incidentAId: s.incidentAId,
      incidentBId: s.incidentBId,
      score: Number(s.score),
      deterministicSignals: s.deterministicSignals as any,
      aiRationale: s.aiRationale,
      status: s.status as 'suggested' | 'confirmed' | 'rejected',
      decidedBy: s.decidedBy
        ? {
            userId: s.decidedBy.id,
            displayName: s.decidedBy.displayName,
          }
        : null,
      decidedAt: s.decidedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    }));
  }
}
