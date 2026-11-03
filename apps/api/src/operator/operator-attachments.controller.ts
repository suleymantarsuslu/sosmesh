/**
 * Operator Attachments Controller
 * Work Package C - Vision
 * 
 * Endpoints for operator access to attachments:
 * - GET /v1/operator/attachments/:id/image
 * - GET /v1/operator/attachments/:id/masks
 */

import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { OperatorAttachmentsService } from './operator-attachments.service';
import { OperatorCasesService } from './operator-cases.service';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('v1/operator/attachments')
@UseGuards(OperatorAuthGuard)
export class OperatorAttachmentsController {
  private readonly logger = new Logger(OperatorAttachmentsController.name);

  constructor(
    private readonly attachmentsService: OperatorAttachmentsService,
    private readonly casesService: OperatorCasesService
  ) {}

  /**
   * GET /v1/operator/attachments/:id/image
   * Serves the sanitized photo (EXIF/GPS stripped)
   */
  @Get(':id/image')
  async getImage(
    @Param('id', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: { organizationId: string },
    @Res() res: Response
  ): Promise<void> {
    this.logger.log({ msg: 'Fetching image', attachmentId });

    // Check organization access
    await this.checkOrganizationAccess(attachmentId, user.organizationId);

    const result = await this.attachmentsService.getAttachmentImage(attachmentId);

    if (!result.found) {
      throw new NotFoundException('Attachment not found');
    }

    if (!result.buffer) {
      throw new InternalServerErrorException('Failed to retrieve image');
    }

    res.setHeader('Content-Type', result.mime);
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(result.buffer);
  }

  /**
   * GET /v1/operator/attachments/:id/masks
   * Returns SAM segmentation results with decoded PNG masks
   * Contract: { imageWidth, imageHeight, segments: [{ concept, id, confidence, box (normalized 0-1), maskPng }] }
   */
  @Get(':id/masks')
  async getMasks(
    @Param('id', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: { organizationId: string }
  ) {
    this.logger.log({ msg: 'Fetching masks', attachmentId });

    // Check organization access
    await this.checkOrganizationAccess(attachmentId, user.organizationId);

    const result = await this.attachmentsService.getAttachmentMasks(attachmentId);

    if (!result.found) {
      throw new NotFoundException('Attachment not found');
    }

    return result;
  }

  private async checkOrganizationAccess(
    attachmentId: string,
    organizationId: string
  ): Promise<void> {
    const attachment = await this.casesService.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        incident: {
          select: {
            sosMessages: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // For demo/synthetic data, allow access
    // In production, check organization ownership via incident
    // TODO: Add proper organization check when multi-org is implemented
  }
}
