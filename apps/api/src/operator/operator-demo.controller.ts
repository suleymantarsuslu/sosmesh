/**
 * Operator Demo Controller - Synthetic SOS creation for demo
 * Work Package A - AI Foundation
 * 
 * POST /v1/operator/demo/sos creates SYNTHETIC SOS (synthetic=true)
 * Accepts text + optional audio/photo multipart
 * Caps: 10 MB audio, 10 MB photo, 120 s audio
 */

import {
  Controller,
  Post,
  UseGuards,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { OperatorDemoService } from './operator-demo.service';

const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10 MB

@Controller('v1/operator/demo')
@UseGuards(OperatorAuthGuard)
export class OperatorDemoController {
  constructor(private readonly demoService: OperatorDemoService) {}

  @Post('sos')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'audio', maxCount: 1 },
      { name: 'photo', maxCount: 1 },
    ])
  )
  async createDemoSos(
    @Body() body: { text?: string; priority?: string; language?: string },
    @UploadedFiles()
    files?: {
      audio?: Array<{ buffer: Buffer; mimetype: string; size: number }>;
      photo?: Array<{ buffer: Buffer; mimetype: string; size: number }>;
    }
  ): Promise<{ incidentId: string; messageId: string }> {
    const text = body.text?.trim();
    if (!text) {
      throw new BadRequestException('text is required');
    }

    if (text.length > 2000) {
      throw new BadRequestException('text exceeds 2000 characters');
    }

    const priority = body.priority ? parseInt(body.priority, 10) : 3;
    if (priority < 1 || priority > 5) {
      throw new BadRequestException('priority must be 1-5');
    }

    const language = body.language ?? 'en';

    const audio = files?.audio?.[0];
    const photo = files?.photo?.[0];

    if (audio && audio.size > MAX_AUDIO_SIZE) {
      throw new BadRequestException(`Audio file exceeds ${MAX_AUDIO_SIZE / 1024 / 1024} MB`);
    }

    if (photo && photo.size > MAX_PHOTO_SIZE) {
      throw new BadRequestException(`Photo file exceeds ${MAX_PHOTO_SIZE / 1024 / 1024} MB`);
    }

    const result = await this.demoService.createSyntheticSos({
      text,
      priority,
      language,
      audioBuffer: audio?.buffer,
      audioMime: audio?.mimetype,
      photoBuffer: photo?.buffer,
      photoMime: photo?.mimetype,
    });

    return result;
  }
}
