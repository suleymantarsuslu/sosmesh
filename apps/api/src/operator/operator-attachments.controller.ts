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
} from '@nestjs/common';
import { Response } from 'express';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { OperatorAttachmentsService } from './operator-attachments.service';

@Controller('v1/operator/attachments')
@UseGuards(OperatorAuthGuard)
export class OperatorAttachmentsController {
  private readonly logger = new Logger(OperatorAttachmentsController.name);

  constructor(private readonly attachmentsService: OperatorAttachmentsService) {}

  /**
   * GET /v1/operator/attachments/:id/image
   * Serves the sanitized photo (EXIF/GPS stripped)
   */
  @Get(':id/image')
  async getImage(@Param('id') attachmentId: string, @Res() res: Response): Promise<void> {
    this.logger.log({ msg: 'Fetching image', attachmentId });

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
   * Returns SAM segmentation results as JSON
   * Format: { segments: [{ concept, boxes, masks }] }
   */
  @Get(':id/masks')
  async getMasks(@Param('id') attachmentId: string) {
    this.logger.log({ msg: 'Fetching masks', attachmentId });

    const result = await this.attachmentsService.getAttachmentMasks(attachmentId);

    if (!result.found) {
      throw new NotFoundException('Attachment not found');
    }

    if (!result.visionAnalysis) {
      return {
        attachmentId,
        analyzed: false,
        segments: [],
      };
    }

    return {
      attachmentId,
      analyzed: true,
      sparkSummary: result.visionAnalysis.sparkSummary,
      samModel: result.visionAnalysis.samModel,
      segments: result.visionAnalysis.samResults,
      analyzedAt: result.visionAnalysis.createdAt,
    };
  }
}
