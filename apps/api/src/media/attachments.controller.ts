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
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
  StreamableFile,
  Header,
  Logger,
  UseInterceptors,
  UploadedFile,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OperatorAuthGuard, OperatorRequest } from '../operator/guards/operator-auth.guard';
import { AudioUploadService } from './audio-upload.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorage, MEDIA_STORAGE } from './media-storage.interface';
import { AiJobQueueService } from '../ai/ai-job-queue.service';
import { IncidentScopeService } from '../organization/incident-scope.service';

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

const MAX_AUDIO_SIZE = 15 * 1024 * 1024;

@Controller('v1/operator')
@UseGuards(OperatorAuthGuard)
export class AttachmentsController {
  private readonly logger = new Logger(AttachmentsController.name);

  constructor(
    private readonly audioUpload: AudioUploadService,
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly jobQueue: AiJobQueueService,
    private readonly scope: IncidentScopeService
  ) {}

  @Post('cases/:caseId/attachments')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: MAX_AUDIO_SIZE },
      fileFilter: (req, file, callback) => {
        if (!ALLOWED_AUDIO_MIMES.includes(file.mimetype)) {
          callback(
            new BadRequestException({
              error: 'invalid_mime',
              message: `Unsupported audio format: ${file.mimetype}`,
              allowedMimes: ALLOWED_AUDIO_MIMES,
            }),
            false
          );
        } else {
          callback(null, true);
        }
      },
    })
  )
  async uploadAudio(
    @Req() req: OperatorRequest,
    @Param('caseId') caseId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    const scopeWhere = this.scope.incidentWhere(req.operatorUser);
    const incident = await this.prisma.incident.findFirst({
      where: {
        id: caseId,
        ...(scopeWhere ?? {}),
      },
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

    const result = await this.audioUpload.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      incidentId: incident.id,
      sosMessageId: incident.sosMessages[0]?.id,
      synthetic: false,
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
  async streamAudio(
    @Req() req: OperatorRequest,
    @Param('attachmentId') attachmentId: string
  ) {
    const scopeWhere = this.scope.incidentWhere(req.operatorUser);

    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        kind: 'audio',
        incident: scopeWhere ?? {},
      },
    });

    if (!attachment) {
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
