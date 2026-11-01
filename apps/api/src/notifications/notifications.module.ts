import { Module } from '@nestjs/common';

import { OrganizationModule } from '../organization/organization.module';
import { ActivityTimelineService } from './activity-timeline.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationInboxService } from './notification-inbox.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [OrganizationModule],
  controllers: [NotificationsController],
  providers: [NotificationDispatchService, NotificationInboxService, ActivityTimelineService],
  exports: [NotificationDispatchService],
})
export class NotificationsModule {}
