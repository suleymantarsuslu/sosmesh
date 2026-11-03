/**
 * Device Attachments Controller - Device-facing media upload
 * 
 * POST /v1/device/attachments - upload audio or image (device auth via upload token)
 * 
 * Security: Upload token binds the upload to a specific SOS (from ingest receipt)
 * Rate limiting: Applied per client IP
 * AI: Enqueues transcribe/vision/fusion jobs when AI is enabled
 */

import {
  Controller,
  Post,
  Body,
  BadRequestException,
  NotFoundException,
  Logger,
  UseInterceptors,
  UploadedFile,
  Inject,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioUploadService } from './audio-upload.service';
import { ImageUploadService } from './image-upload.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiJobQueueService } from '../ai/ai-job-queue.service';
import { DeviceUploadTokenService } from './device-upload-token.service';
import {
  MEDIA_ONLINE_MAX_AUDIO_BYTES,
  MEDIA_ONLINE_MAX_IMAGE_BYTES,
} from './media.constants';

const ALLOWED_AUDIO_MIMES = [
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
];

const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE = Math.max(MEDIA_ONLINE_MAX_AUDIO_BYTES, MEDIA_ONLINE_MAX_IMAGE_BYTES);

@Controller('v1/device')
export class DeviceAttachmentsController {
  private readonly logger = new Logger(DeviceAttachmentsController.name);

  constructor(
    private readonly audioUpload: AudioUploadService,
    private readonly imageUpload: ImageUploadService,
    private readonly prisma: PrismaService,
    private readonly jobQueue: AiJobQueueService,
    private readonly tokenService: DeviceUploadTokenService
  ) {}

  @Post('attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (req, file, callback) => {
        const allowedMimes = [...ALLOWED_AUDIO_MIMES, ...ALLOWED_IMAGE_MIMES];
        if (!allowedMimes.includes(file.mimetype)) {
          callback(
            new BadRequestException({
              error: 'invalid_mime',
              message: `Unsupported media format: ${file.mimetype}`,
              allowedMimes,
            }),
            false
          );
        } else {
          callback(null, true);
        }
      },
    })
  )
  async uploadAttachment(
    @Headers('x-upload-token') uploadToken: string | undefined,
    @Body('kind') kind: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number }
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!uploadToken) {
      throw new BadRequestException('x-upload-token header is required');
    }

    if (kind !== 'audio' && kind !== 'image') {
      throw new BadRequestException('kind must be audio or image');
    }

    const sosMessage = await this.prisma.sosMessage.findUnique({
      where: { messageId: uploadToken.split(':')[0] },
      include: {
        incident: true,
      },
    });

    if (!sosMessage) {
      throw new NotFoundException('SOS message not found');
    }

    const messageId = this.tokenService.verifyToken(uploadToken, sosMessage.packetHash ?? '');

    if (messageId !== sosMessage.messageId) {
      throw new BadRequestException('Token does not match message');
    }

    if (kind === 'audio') {
      if (!ALLOWED_AUDIO_MIMES.includes(file.mimetype)) {
        throw new BadRequestException('Invalid audio mime type');
      }

      const result = await this.audioUpload.upload({
        buffer: file.buffer,
        mimeType: file.mimetype,
        incidentId: sosMessage.incidentId,
        sosMessageId: sosMessage.id,
        synthetic: false,
        source: 'online',
      });

      if (process.env.AI_ENABLED === 'true') {
        const jobId = await this.jobQueue.enqueue({
          kind: 'transcribe',
          incidentId: sosMessage.incidentId,
          sosMessageId: sosMessage.id,
          attachmentId: result.attachmentId,
        });

        this.logger.log({
          msg: 'Device audio uploaded',
          attachmentId: result.attachmentId,
          messageId,
          jobId,
        });
      }

      return {
        attachmentId: result.attachmentId,
        sha256: result.sha256,
        sizeBytes: result.sizeBytes,
        durationMs: result.durationMs,
      };
    } else {
      if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
        throw new BadRequestException('Invalid image mime type');
      }

      const result = await this.imageUpload.upload({
        buffer: file.buffer,
        mimeType: file.mimetype,
        incidentId: sosMessage.incidentId,
        sosMessageId: sosMessage.id,
        source: 'online',
      });

      if (process.env.AI_ENABLED === 'true') {
        const jobId = await this.jobQueue.enqueue({
          kind: 'vision',
          incidentId: sosMessage.incidentId,
          sosMessageId: sosMessage.id,
          attachmentId: result.attachmentId,
        });

        this.logger.log({
          msg: 'Device image uploaded',
          attachmentId: result.attachmentId,
          messageId,
          jobId,
        });
      }

      return {
        attachmentId: result.attachmentId,
        sha256: result.sha256,
        sizeBytes: result.sizeBytes,
      };
    }
  }
}
