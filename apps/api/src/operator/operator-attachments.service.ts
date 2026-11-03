/**
 * Operator Attachments Service
 * Work Package C - Vision
 * 
 * Handles retrieval of attachments and vision analysis for operator panel
 * Decodes SAM masks to PNG on server
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocalDiskStorageService } from '../media/local-disk-storage.service';
import { SamMaskDecoderService } from '../ai/vision/sam-mask-decoder.service';

export type AttachmentImageResult =
  | { found: true; buffer: Buffer; mime: string }
  | { found: false };

export type MaskSegment = {
  concept: string;
  id: string;
  confidence: number | null;
  box: {
    x: number; // normalized 0-1
    y: number; // normalized 0-1
    w: number; // normalized 0-1
    h: number; // normalized 0-1
  };
  maskPng: string | null; // data:image/png;base64,... at box size with transparency
};

export type AttachmentMasksResult =
  | {
      found: true;
      imageWidth: number;
      imageHeight: number;
      segments: MaskSegment[];
    }
  | { found: false };

@Injectable()
export class OperatorAttachmentsService {
  private readonly logger = new Logger(OperatorAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalDiskStorageService,
    private readonly maskDecoder: SamMaskDecoderService
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

    if (attachment.kind !== 'photo' && attachment.kind !== 'image') {
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
   * Decodes SAM masks to PNG on server
   */
  async getAttachmentMasks(attachmentId: string): Promise<AttachmentMasksResult> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        storageKey: true,
        visionAnalysis: {
          select: {
            samResults: true,
          },
        },
      },
    });

    if (!attachment || !attachment.visionAnalysis) {
      return { found: false };
    }

    // Masks are decoded from the stored analysis; the media file is addressed by its
    // storage key (not the attachment id) and is only checked for presence.
    const metadata = await this.storage.getMetadata(attachment.storageKey);
    if (!metadata) {
      this.logger.warn({
        msg: 'Storage key not found for masks request',
        attachmentId,
        storageKey: attachment.storageKey,
      });
      return { found: false };
    }

    const samResults = Array.isArray(attachment.visionAnalysis.samResults)
      ? (attachment.visionAnalysis.samResults as any[])
      : [];
    const segments: MaskSegment[] = [];

    // SAM reports the analysed image size in every bounding box; use it for the
    // canvas dimensions instead of a hard-coded placeholder.
    let imageWidth = 0;
    let imageHeight = 0;

    for (const conceptResult of samResults) {
      const concept = conceptResult.concept as string;
      const conceptSegments = Array.isArray(conceptResult.segments) ? (conceptResult.segments as any[]) : [];

      for (const segment of conceptSegments) {
        const box = segment.boundingBox;
        const mask = segment.mask;

        if (imageWidth === 0 && box.width > 0 && box.height > 0) {
          imageWidth = box.width;
          imageHeight = box.height;
        }

        // Normalize box coordinates
        const normalizedBox = {
          x: box.x1 / box.width,
          y: box.y1 / box.height,
          w: (box.x2 - box.x1 + 1) / box.width,
          h: (box.y2 - box.y1 + 1) / box.height,
        };

        let maskPng: string | null = null;

        if (mask) {
          try {
            // Box dimensions in pixels
            const boxWidthPx = box.x2 - box.x1 + 1;
            const boxHeightPx = box.y2 - box.y1 + 1;

            maskPng = await this.maskDecoder.decodeMaskToPng(
              mask.data,
              mask.width,
              mask.height,
              boxWidthPx,
              boxHeightPx
            );
          } catch (error) {
            this.logger.error({
              err: error,
              msg: 'Failed to decode mask',
              attachmentId,
              concept,
              segmentId: segment.id,
            });
          }
        }

        segments.push({
          concept,
          id: segment.id,
          confidence: segment.confidence,
          box: normalizedBox,
          maskPng,
        });
      }
    }

    return {
      found: true,
      imageWidth,
      imageHeight,
      segments,
    };
  }
}
