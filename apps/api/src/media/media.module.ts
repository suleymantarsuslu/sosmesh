/**
 * Media Module - Audio/photo upload and storage
 * Work Package B - Voice Rescue
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { LocalDiskStorageService } from './local-disk-storage.service';
import { MEDIA_STORAGE } from './media-storage.interface';
import { AudioConversionService } from './audio-conversion.service';
import { AudioUploadService } from './audio-upload.service';
import { AttachmentsController } from './attachments.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, OrganizationModule, AiModule],
  providers: [
    {
      provide: MEDIA_STORAGE,
      useClass: LocalDiskStorageService,
    },
    AudioConversionService,
    AudioUploadService,
  ],
  controllers: [AttachmentsController],
  exports: [MEDIA_STORAGE, AudioConversionService, AudioUploadService],
})
export class MediaModule {}
