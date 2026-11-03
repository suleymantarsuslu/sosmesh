/**
 * Audio Upload Service - Validate, store, and create audio attachments
 * Work Package B - Voice Rescue
 * 
 * Validates: mime (wav, m4a/aac, ogg/opus, webm, mp3), size (10 MB), duration (120s)
 * Computes sha256, writes to MediaStorage, creates Attachment record
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorage, MEDIA_STORAGE } from './media-storage.interface';
import { AudioConversionService } from './audio-conversion.service';
import { Inject } from '@nestjs/common';

const ALLOWED_MIMES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_MS = 120 * 1000;

export type AudioUploadRequest = {
  buffer: Buffer;
  mimeType: string;
  incidentId: string;
  sosMessageId?: string;
  synthetic?: boolean;
};

export type AudioUploadResult = {
  attachmentId: string;
  sha256: string;
  sizeBytes: number;
  durationMs: number;
};

@Injectable()
export class AudioUploadService {
  private readonly logger = new Logger(AudioUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly conversion: AudioConversionService
  ) {}

  async upload(request: AudioUploadRequest): Promise<AudioUploadResult> {
    this.validateMime(request.mimeType);
    this.validateSize(request.buffer);

    const durationMs = await this.conversion.validateDuration(request.buffer, request.mimeType);
    this.validateDuration(durationMs);

    const sha256 = createHash('sha256').update(request.buffer).digest('hex');

    const existingAttachment = await this.prisma.attachment.findFirst({
      where: {
        sha256,
        incidentId: request.incidentId,
      },
    });

    if (existingAttachment) {
      this.logger.debug({
        msg: 'Audio already exists',
        attachmentId: existingAttachment.id,
        sha256,
      });

      return {
        attachmentId: existingAttachment.id,
        sha256: existingAttachment.sha256,
        sizeBytes: existingAttachment.sizeBytes,
        durationMs: existingAttachment.durationMs ?? durationMs,
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
        kind: 'audio',
        mime: request.mimeType,
        sizeBytes: storeResult.sizeBytes,
        durationMs,
        storageKey: storeResult.storageKey,
        sha256: storeResult.sha256,
        synthetic: request.synthetic ?? false,
        expiresAt,
      },
    });

    this.logger.log({
      msg: 'Audio uploaded',
      attachmentId: attachment.id,
      sizeBytes: storeResult.sizeBytes,
      durationMs,
    });

    return {
      attachmentId: attachment.id,
      sha256: attachment.sha256,
      sizeBytes: attachment.sizeBytes,
      durationMs,
    };
  }

  private validateMime(mime: string): void {
    if (!ALLOWED_MIMES.has(mime)) {
      throw new BadRequestException({
        error: 'invalid_mime',
        message: `Unsupported audio format: ${mime}`,
        allowedMimes: Array.from(ALLOWED_MIMES),
      });
    }
  }

  private validateSize(buffer: Buffer): void {
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new BadRequestException({
        error: 'file_too_large',
        message: `Audio exceeds ${MAX_SIZE_BYTES} bytes`,
        sizeBytes: buffer.length,
        maxBytes: MAX_SIZE_BYTES,
      });
    }
  }

  private validateDuration(durationMs: number): void {
    if (durationMs > MAX_DURATION_MS) {
      throw new BadRequestException({
        error: 'duration_too_long',
        message: `Audio exceeds ${MAX_DURATION_MS / 1000}s duration`,
        durationMs,
        maxDurationMs: MAX_DURATION_MS,
      });
    }
  }
}
