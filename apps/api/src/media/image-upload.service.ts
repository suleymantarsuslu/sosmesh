/**
 * Image Upload Service - Validate, store, and create image attachments
 * 
 * Validates: mime (jpeg, png, webp), size
 * Computes sha256, writes to MediaStorage, creates Attachment record
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorage, MEDIA_STORAGE } from './media-storage.interface';
import { Inject } from '@nestjs/common';
import { type MediaSource, getMediaLimits } from './media.constants';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export type ImageUploadRequest = {
  buffer: Buffer;
  mimeType: string;
  incidentId: string;
  sosMessageId?: string;
  source?: MediaSource;
};

export type ImageUploadResult = {
  attachmentId: string;
  sha256: string;
  sizeBytes: number;
};

@Injectable()
export class ImageUploadService {
  private readonly logger = new Logger(ImageUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage
  ) {}

  async upload(request: ImageUploadRequest): Promise<ImageUploadResult> {
    const source = request.source ?? 'online';
    const limits = getMediaLimits(source);

    this.validateMime(request.mimeType);
    this.validateSize(request.buffer, limits.maxImageBytes);

    const sha256 = createHash('sha256').update(request.buffer).digest('hex');

    const existingAttachment = await this.prisma.attachment.findFirst({
      where: {
        sha256,
        incidentId: request.incidentId,
      },
    });

    if (existingAttachment) {
      this.logger.debug({
        msg: 'Image already exists',
        attachmentId: existingAttachment.id,
        sha256,
      });

      return {
        attachmentId: existingAttachment.id,
        sha256: existingAttachment.sha256,
        sizeBytes: existingAttachment.sizeBytes,
      };
    }

    const storeResult = await this.storage.store({
      buffer: request.buffer,
      mimeType: request.mimeType,
      sha256,
    });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const attachment = await this.prisma.attachment.create({
      data: {
        incidentId: request.incidentId,
        sosMessageId: request.sosMessageId ?? null,
        kind: 'image',
        mime: request.mimeType,
        sizeBytes: storeResult.sizeBytes,
        durationMs: null,
        storageKey: storeResult.storageKey,
        sha256: storeResult.sha256,
        synthetic: false,
        expiresAt,
      },
    });

    this.logger.log({
      msg: 'Image uploaded',
      attachmentId: attachment.id,
      sizeBytes: storeResult.sizeBytes,
    });

    return {
      attachmentId: attachment.id,
      sha256: attachment.sha256,
      sizeBytes: attachment.sizeBytes,
    };
  }

  private validateMime(mime: string): void {
    if (!ALLOWED_IMAGE_MIMES.has(mime)) {
      throw new BadRequestException({
        error: 'invalid_mime',
        message: `Unsupported image format: ${mime}`,
        allowedMimes: Array.from(ALLOWED_IMAGE_MIMES),
      });
    }
  }

  private validateSize(buffer: Buffer, maxBytes: number): void {
    if (buffer.length > maxBytes) {
      throw new BadRequestException({
        error: 'file_too_large',
        message: `Image exceeds ${maxBytes} bytes`,
        sizeBytes: buffer.length,
        maxBytes,
      });
    }
  }
}
