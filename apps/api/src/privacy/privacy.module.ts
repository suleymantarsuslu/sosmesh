import { Module } from '@nestjs/common';

import { OrganizationModule } from '../organization/organization.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyEraseService } from './privacy-erase.service';
import { PrivacyExportService } from './privacy-export.service';
import { PrivacyRetentionService } from './privacy-retention.service';

@Module({
  imports: [OrganizationModule],
  controllers: [PrivacyController],
  providers: [PrivacyEraseService, PrivacyExportService, PrivacyRetentionService],
  exports: [PrivacyRetentionService, PrivacyEraseService, PrivacyExportService],
})
export class PrivacyModule {}
