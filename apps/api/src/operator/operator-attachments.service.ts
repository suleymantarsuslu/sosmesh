/**
 * Operator Attachments Service
 * Work Package C - Vision
 * 
 * Handles retrieval of attachments and vision analysis for operator panel
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocalDiskStorageService } from '../media/local-disk-storage.service';

export type AttachmentImageResult =
  | { found: true; buffer: Buffer; mime: string }
  | { found: false };

export type AttachmentMasksResult =
  | {
      found: true;
      visionAnalysis: {
        sparkSummary: unknown;
        samResults: unknown;
        samModel: string | null;
        createdAt: Date;
      } | null;
    }
  | { found: false };

@Injectable()
export class OperatorAttachmentsService {
  private readonly logger = new Logger(OperatorAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalDiskStorageService
  ) {}

  /**
   * Get attachment image buffer
   */
  async getAttachmentImage(attachmentId: string): Promise<AttachmentImageResult> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        storageKey: true,
        mime: true,
        kind: true,
      },
    });

    if (!attachment) {
      return { found: false };
    }

    if (attachment.kind !== 'photo') {
      this.logger.warn({
        msg: 'Requested image for non-photo attachment',
        attachmentId,
        kind: attachment.kind,
      });
      return { found: false };
    }

    const buffer = await this.storage.retrieve(attachment.storageKey);

    if (!buffer) {
      this.logger.error({
        msg: 'Storage key not found',
        attachmentId,
        storageKey: attachment.storageKey,
      });
      return { found: false };
    }

    return {
      found: true,
      buffer,
      mime: attachment.mime,
    };
  }

  /**
   * Get vision analysis (Spark + SAM) for attachment
   */
  async getAttachmentMasks(attachmentId: string): Promise<AttachmentMasksResult> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        visionAnalysis: {
          select: {
            sparkSummary: true,
            samResults: true,
            samModel: true,
            createdAt: true,
          },
        },
      },
    });

    if (!attachment) {
      return { found: false };
    }

    return {
      found: true,
      visionAnalysis: attachment.visionAnalysis,
    };
  }
}
