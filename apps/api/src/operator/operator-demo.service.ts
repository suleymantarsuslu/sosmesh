/**
 * Operator Demo Service - Create synthetic SOS for demo
 * Work Package A - AI Foundation
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaService } from '../prisma/prisma.service';
import { AiJobQueueService } from '../ai/ai-job-queue.service';
import { LocalDiskStorageService } from '../media/local-disk-storage.service';
import { PhotoValidatorService } from '../ai/vision/photo-validator.service';
import { DeliveryState, IncidentState, LocationStatus } from '@prisma/client';

const execAsync = promisify(exec);

export type CreateSyntheticSosRequest = {
  text: string;
  priority: number;
  language: string;
  audioBuffer?: Buffer;
  audioMime?: string;
  photoBuffer?: Buffer;
  photoMime?: string;
};

@Injectable()
export class OperatorDemoService {
  private readonly logger = new Logger(OperatorDemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiJobQueue: AiJobQueueService,
    private readonly mediaStorage: LocalDiskStorageService,
    private readonly photoValidator: PhotoValidatorService
  ) {}

  async createSyntheticSos(
    request: CreateSyntheticSosRequest
  ): Promise<{ incidentId: string; messageId: string }> {
    const messageId = `demo-${randomBytes(16).toString('hex')}`;

    // Validate audio duration if audio provided
    if (request.audioBuffer) {
      await this.validateAudioDuration(request.audioBuffer);
    }

    // Store media AFTER transaction to avoid orphaned files on rollback
    let audioStorageKey: string | undefined;
    let audioSha256: string | undefined;
    let audioSizeBytes: number | undefined;
    let photoStorageKey: string | undefined;
    let photoSha256: string | undefined;
    let photoSizeBytes: number | undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: { state: IncidentState.PENDING },
      });

      const message = await tx.sosMessage.create({
        data: {
          messageId,
          incidentId: incident.id,
          deliveryState: DeliveryState.SERVER_ACCEPTED,
          locationStatus: LocationStatus.UNKNOWN,
          priority: request.priority,
          noteText: request.text,
          operatorDisplayText: `[DEMO SYNTHETIC] ${request.text}`,
          synthetic: true,
          serverReceiptAt: new Date(),
          needsHumanReview: false,
        },
      });

      // Create attachment records (media stored after commit)
      if (request.audioBuffer && request.audioMime) {
        await tx.attachment.create({
          data: {
            incidentId: incident.id,
            sosMessageId: message.id,
            kind: 'audio',
            mime: request.audioMime,
            sizeBytes: 0, // Placeholder, will be updated after storage
            storageKey: 'pending',
            sha256: 'pending',
            synthetic: true,
          },
        });
      }

      if (request.photoBuffer && request.photoMime) {
        await tx.attachment.create({
          data: {
            incidentId: incident.id,
            sosMessageId: message.id,
            kind: 'photo',
            mime: request.photoMime,
            sizeBytes: 0, // Placeholder, will be updated after storage
            storageKey: 'pending',
            sha256: 'pending',
            synthetic: true,
          },
        });
      }

      await tx.messageEvent.create({
        data: {
          sosMessageId: message.id,
          deliveryState: DeliveryState.SERVER_ACCEPTED,
          source: 'demo',
        },
      });

      return { incidentId: incident.id, sosMessageId: message.id };
    });

    // Store media AFTER transaction commits
    if (request.audioBuffer && request.audioMime) {
      const stored = await this.mediaStorage.store({
        buffer: request.audioBuffer,
        mimeType: request.audioMime,
      });
      audioStorageKey = stored.storageKey;
      audioSha256 = stored.sha256;
      audioSizeBytes = stored.sizeBytes;

      // Update attachment with actual storage info
      await this.prisma.attachment.updateMany({
        where: {
          incidentId: result.incidentId,
          kind: 'audio',
          storageKey: 'pending',
        },
        data: {
          storageKey: audioStorageKey,
          sha256: audioSha256,
          sizeBytes: audioSizeBytes,
        },
      });
    }

    if (request.photoBuffer && request.photoMime) {
      // Validate and sanitize photo (strips EXIF/GPS, downscales if needed)
      const validated = await this.photoValidator.validateAndSanitize({
        buffer: request.photoBuffer,
        source: 'online', // Demo uploads are online
      });

      if (!validated.valid) {
        const reason = 'reason' in validated ? validated.reason : 'unknown';
        throw new BadRequestException(`Photo validation failed: ${reason}`);
      }

      const stored = await this.mediaStorage.store({
        buffer: validated.buffer,
        mimeType: validated.mime,
        sha256: validated.sha256,
      });
      photoStorageKey = stored.storageKey;
      photoSha256 = stored.sha256;
      photoSizeBytes = stored.sizeBytes;

      // Update attachment with actual storage info
      await this.prisma.attachment.updateMany({
        where: {
          incidentId: result.incidentId,
          kind: 'photo',
          storageKey: 'pending',
        },
        data: {
          storageKey: photoStorageKey,
          sha256: photoSha256,
          sizeBytes: photoSizeBytes,
          mime: validated.mime, // Update with sanitized mime type
        },
      });
    }

    this.logger.log({
      msg: 'Synthetic SOS created',
      messageId,
      incidentId: result.incidentId,
      hasAudio: !!audioStorageKey,
      hasPhoto: !!photoStorageKey,
    });

    // Enqueue AI job after commit
    if (process.env.AI_ENABLED === 'true') {
      void this.aiJobQueue
        .enqueue({
          kind: 'triage',
          incidentId: result.incidentId,
          sosMessageId: result.sosMessageId,
        })
        .catch((error) => {
          this.logger.error({
            code: 'AI_ENQUEUE_FAILED',
            incidentId: result.incidentId,
            error: error instanceof Error ? error.message : 'unknown',
          });
        });
    }

    return { incidentId: result.incidentId, messageId };
  }

  private async validateAudioDuration(audioBuffer: Buffer): Promise<void> {
    const tempPath = join(tmpdir(), `demo-audio-${randomBytes(8).toString('hex')}`);

    try {
      await writeFile(tempPath, audioBuffer);

      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempPath}"`
      );

      const duration = parseFloat(stdout.trim());

      if (isNaN(duration)) {
        throw new BadRequestException('Invalid audio file format');
      }

      if (duration > 120) {
        throw new BadRequestException(`Audio duration ${duration.toFixed(1)}s exceeds 120s limit`);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // If ffprobe fails, log but don't block (ffprobe might not be installed in dev)
      this.logger.warn({
        code: 'FFPROBE_FAILED',
        message: error instanceof Error ? error.message.substring(0, 200) : 'unknown',
      });
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  }
}
