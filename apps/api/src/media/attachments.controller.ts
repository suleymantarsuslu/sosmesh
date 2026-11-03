/**
 * Attachments Controller - Audio upload and streaming
 * Work Package B - Voice Rescue
 * 
 * POST /v1/operator/cases/:id/attachments - upload audio (operator auth)
 * GET /v1/operator/attachments/:id/audio - stream audio (operator auth, correct content-type)
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
  StreamableFile,
  Header,
  Logger,
} from '@nestjs/common';
import { OperatorAuthGuard } from '../auth/operator-auth.guard';
import { AudioUploadService } from './audio-upload.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorage, MEDIA_STORAGE } from './media-storage.interface';
import { AiJobQueueService } from '../ai/ai-job-queue.service';
import { Inject } from '@nestjs/common';

export type UploadAudioDto = {
  audioBase64: string;
  mimeType: string;
  synthetic?: boolean;
};

@Controller('v1/operator')
@UseGuards(OperatorAuthGuard)
export class AttachmentsController {
  private readonly logger = new Logger(AttachmentsController.name);

  constructor(
    private readonly audioUpload: AudioUploadService,
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly jobQueue: AiJobQueueService
  ) {}

  @Post('cases/:caseId/attachments')
  async uploadAudio(
    @Param('caseId') caseId: string,
    @Body() dto: UploadAudioDto
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: caseId },
      include: {
        sosMessages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('Case not found');
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(dto.audioBase64, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 audio data');
    }

    const result = await this.audioUpload.upload({
      buffer,
      mimeType: dto.mimeType,
      incidentId: incident.id,
      sosMessageId: incident.sosMessages[0]?.id,
      synthetic: dto.synthetic ?? false,
    });

    const jobId = await this.jobQueue.enqueue({
      kind: 'transcribe',
      incidentId: incident.id,
      sosMessageId: incident.sosMessages[0]?.id,
      attachmentId: result.attachmentId,
    });

    this.logger.log({
      msg: 'Audio uploaded',
      attachmentId: result.attachmentId,
      caseId,
      jobId,
    });

    return {
      attachmentId: result.attachmentId,
      sha256: result.sha256,
      sizeBytes: result.sizeBytes,
      durationMs: result.durationMs,
      jobId,
    };
  }

  @Get('attachments/:attachmentId/audio')
  @Header('Cache-Control', 'private, max-age=3600')
  async streamAudio(@Param('attachmentId') attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.kind !== 'audio') {
      throw new NotFoundException('Audio attachment not found');
    }

    const buffer = await this.storage.retrieve(attachment.storageKey);

    if (!buffer) {
      throw new NotFoundException('Audio file not found in storage');
    }

    return new StreamableFile(buffer, {
      type: attachment.mime,
      disposition: `inline; filename="audio-${attachmentId.substring(0, 8)}.${this.getExtension(attachment.mime)}"`,
    });
  }

  private getExtension(mime: string): string {
    const map: Record<string, string> = {
      'audio/wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
    };

    return map[mime] ?? 'bin';
  }
}
