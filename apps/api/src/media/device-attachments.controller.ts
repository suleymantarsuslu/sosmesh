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
import { createHash } from 'crypto';
import type { EncryptedPayload, ServerCryptoConfig } from '@sosmesh/contracts';
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

/** Relay-carried (BLE) copies are shrunk on the sender: the ciphertext upload stays far below these. */
export const RELAYED_MAX_CIPHERTEXT_BYTES = 512 * 1024;

let decryptPayloadFn: typeof import('@sosmesh/contracts').decryptPayload | null = null;
async function getDecryptPayload() {
  if (!decryptPayloadFn) {
    const { decryptPayload } = await import('@sosmesh/contracts');
    decryptPayloadFn = decryptPayload;
  }
  return decryptPayloadFn;
}

function relayedServerConfig(): ServerCryptoConfig | null {
  const privateKey = process.env.SOSMESH_SERVER_SOS_PRIVATE_KEY;
  const keyId = process.env.SOSMESH_SERVER_SOS_KEY_ID;
  if (!privateKey || !keyId) return null;
  if (process.env.NODE_ENV === 'production' && keyId.startsWith('dev-test')) return null;
  return { keyId, serverPrivateKey: privateKey, serverPublicKey: '' };
}

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

  /**
   * POST /v1/device/attachments/relayed - a relay uploads an opaque, sender-encrypted, size-capped copy of an attachment
   * it carried over BLE. multipart: `file` = ciphertext bytes, fields kind, attachmentId, nonce, ephemeralPublicKey, keyId.
   * Plaintext (existing inner scheme, JSON) = {"mime","sha256","data":base64}; AAD envelope binds purpose, sosId, attachmentId, kind.
   * The stored row keeps the sender's ORIGINAL sha256, so the sender's own later direct upload of the original dedups
   * against it (first arrival wins) and the other way round.
   */
  @Post('attachments/relayed')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: RELAYED_MAX_CIPHERTEXT_BYTES } }))
  async uploadRelayedAttachment(
    @Headers('x-upload-token') uploadToken: string | undefined,
    @Body() body: { kind?: string; attachmentId?: string; nonce?: string; ephemeralPublicKey?: string; keyId?: string },
    @UploadedFile() file?: { buffer: Buffer; size: number }
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!uploadToken) throw new BadRequestException('x-upload-token header is required');
    const kind = body.kind;
    if (kind !== 'audio' && kind !== 'image') throw new BadRequestException('kind must be audio or image');
    const { attachmentId, nonce, ephemeralPublicKey, keyId } = body;
    if (!attachmentId || !nonce || !ephemeralPublicKey || !keyId) {
      throw new BadRequestException('attachmentId, nonce, ephemeralPublicKey and keyId are required');
    }

    const sosMessage = await this.prisma.sosMessage.findUnique({
      where: { messageId: uploadToken.split(':')[0] },
    });
    if (!sosMessage) throw new NotFoundException('SOS message not found');
    const messageId = this.tokenService.verifyToken(uploadToken, sosMessage.packetHash ?? '');
    if (messageId !== sosMessage.messageId) throw new BadRequestException('Token does not match message');

    const config = relayedServerConfig();
    if (!config || keyId !== config.keyId) throw new BadRequestException('Unsupported key');

    let inner: { mime?: unknown; sha256?: unknown; data?: unknown };
    try {
      const decrypt = await getDecryptPayload();
      const encrypted: EncryptedPayload = {
        ciphertext: file.buffer.toString('base64'),
        nonce,
        ephemeralPublicKey,
        keyId,
      };
      inner = decrypt(encrypted, { purpose: 'attachment', sosId: messageId, attachmentId, kind }, config);
    } catch {
      throw new BadRequestException('Attachment cannot be decrypted');
    }

    const mime = typeof inner?.mime === 'string' ? inner.mime : '';
    const originalSha = typeof inner?.sha256 === 'string' ? inner.sha256 : '';
    const media = typeof inner?.data === 'string' ? Buffer.from(inner.data, 'base64') : Buffer.alloc(0);
    if (!/^[a-f0-9]{64}$/.test(originalSha)) throw new BadRequestException('Malformed attachment digest');
    if (media.length === 0) throw new BadRequestException('Empty attachment');
    if (kind === 'audio' ? !ALLOWED_AUDIO_MIMES.includes(mime) : !ALLOWED_IMAGE_MIMES.includes(mime)) {
      throw new BadRequestException(`Invalid ${kind} mime type`);
    }

    const existing = await this.prisma.attachment.findFirst({
      where: { sha256: originalSha, incidentId: sosMessage.incidentId },
    });
    if (existing) {
      return { attachmentId: existing.id, sha256: existing.sha256, sizeBytes: existing.sizeBytes, duplicate: true };
    }

    const shrunkSha = createHash('sha256').update(media).digest('hex');
    const result =
      kind === 'audio'
        ? await this.audioUpload.upload({
            buffer: media,
            mimeType: mime,
            incidentId: sosMessage.incidentId,
            sosMessageId: sosMessage.id,
            synthetic: false,
            source: 'online',
          })
        : await this.imageUpload.upload({
            buffer: media,
            mimeType: mime,
            incidentId: sosMessage.incidentId,
            sosMessageId: sosMessage.id,
            source: 'online',
          });
    if (result.sha256 === shrunkSha && shrunkSha !== originalSha) {
      await this.prisma.attachment.update({ where: { id: result.attachmentId }, data: { sha256: originalSha } });
    }

    if (process.env.AI_ENABLED === 'true') {
      await this.jobQueue.enqueue({
        kind: kind === 'audio' ? 'transcribe' : 'vision',
        incidentId: sosMessage.incidentId,
        sosMessageId: sosMessage.id,
        attachmentId: result.attachmentId,
      });
    }
    this.logger.log({ msg: 'Relayed attachment stored', attachmentId: result.attachmentId, messageId, kind });
    return { attachmentId: result.attachmentId, sha256: originalSha, sizeBytes: result.sizeBytes };
  }
}
