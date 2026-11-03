import { Module } from '@nestjs/common';

import { OrganizationModule } from '../organization/organization.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyEraseService } from './privacy-erase.service';
import { PrivacyExportService } from './privacy-export.service';
import { PrivacyRetentionService } from './privacy-retention.service';
import { LocalDiskStorageService } from '../media/local-disk-storage.service';
import { MEDIA_STORAGE } from '../media/media-storage.interface';

@Module({
  imports: [OrganizationModule],
  controllers: [PrivacyController],
  providers: [
    PrivacyEraseService,
    PrivacyExportService,
    PrivacyRetentionService,
    {
      provide: MEDIA_STORAGE,
      useClass: LocalDiskStorageService,
    },
  ],
  exports: [PrivacyRetentionService, PrivacyEraseService, PrivacyExportService],
})
export class PrivacyModule {}
