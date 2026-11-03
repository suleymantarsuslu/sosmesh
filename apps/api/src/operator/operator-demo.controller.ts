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
    @Body()
    body: {
      text?: string;
      priority?: string;
      language?: string;
      latitude?: string;
      longitude?: string;
    },
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

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (body.latitude !== undefined || body.longitude !== undefined) {
      if (body.latitude === undefined || body.longitude === undefined) {
        throw new BadRequestException('Both latitude and longitude required if either is provided');
      }

      latitude = parseFloat(body.latitude);
      longitude = parseFloat(body.longitude);

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new BadRequestException('Invalid latitude or longitude');
      }

      if (latitude < -90 || latitude > 90) {
        throw new BadRequestException('Latitude must be between -90 and 90');
      }

      if (longitude < -180 || longitude > 180) {
        throw new BadRequestException('Longitude must be between -180 and 180');
      }
    }

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
      latitude,
      longitude,
      audioBuffer: audio?.buffer,
      audioMime: audio?.mimetype,
      photoBuffer: photo?.buffer,
      photoMime: photo?.mimetype,
    });

    return result;
  }
}
