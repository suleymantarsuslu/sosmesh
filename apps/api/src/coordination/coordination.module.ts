import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { CoordinationController } from './coordination.controller';
import { LocationShareService } from './location-share.service';
import { TeamsResourcesService } from './teams-resources.service';
import { WorkTaskService } from './work-task.service';

@Module({
  imports: [OrganizationModule, NotificationsModule],
  controllers: [CoordinationController],
  providers: [TeamsResourcesService, WorkTaskService, LocationShareService],
  exports: [WorkTaskService],
})
export class CoordinationModule {}
