/**
 * Operator Demo Service - Create synthetic SOS for demo
 * Work Package A - AI Foundation
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AiJobQueueService } from '../ai/ai-job-queue.service';
import { LocalDiskStorageService } from '../media/local-disk-storage.service';
import { PhotoValidatorService } from '../ai/vision/photo-validator.service';
import { DeliveryState, IncidentState, LocationStatus } from '@prisma/client';

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

    // Store media if provided
    let audioAttachmentId: string | undefined;
    let photoAttachmentId: string | undefined;

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

      // Store audio attachment if provided
      if (request.audioBuffer && request.audioMime) {
        const stored = await this.mediaStorage.store({
          buffer: request.audioBuffer,
          mimeType: request.audioMime,
        });

        const audioAttachment = await tx.attachment.create({
          data: {
            incidentId: incident.id,
            sosMessageId: message.id,
            kind: 'audio',
            mime: request.audioMime,
            sizeBytes: stored.sizeBytes,
            storageKey: stored.storageKey,
            sha256: stored.sha256,
            synthetic: true,
          },
        });

        audioAttachmentId = audioAttachment.id;
      }

      // Store photo attachment if provided (EXIF/GPS stripped)
      if (request.photoBuffer && request.photoMime) {
        // Validate and sanitize photo (strips EXIF/GPS, downscales if needed)
        const validated = await this.photoValidator.validateAndSanitize({
          buffer: request.photoBuffer,
          source: 'online', // Demo uploads are online
        });

        if (!validated.valid) {
          const reason = 'reason' in validated ? validated.reason : 'unknown';
          throw new Error(`Photo validation failed: ${reason}`);
        }

        const stored = await this.mediaStorage.store({
          buffer: validated.buffer,
          mimeType: validated.mime,
          sha256: validated.sha256,
        });

        const photoAttachment = await tx.attachment.create({
          data: {
            incidentId: incident.id,
            sosMessageId: message.id,
            kind: 'photo',
            mime: validated.mime,
            sizeBytes: stored.sizeBytes,
            storageKey: stored.storageKey,
            sha256: stored.sha256,
            synthetic: true,
          },
        });

        photoAttachmentId = photoAttachment.id;
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

    this.logger.log({
      msg: 'Synthetic SOS created',
      messageId,
      incidentId: result.incidentId,
      hasAudio: !!audioAttachmentId,
      hasPhoto: !!photoAttachmentId,
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
}
