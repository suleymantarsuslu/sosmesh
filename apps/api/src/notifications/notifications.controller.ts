import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { OperatorAuthGuard, OperatorRequest } from '../operator/guards/operator-auth.guard';
import { OperatorCsrfGuard } from '../operator/guards/operator-csrf.guard';
import { RolesGuard } from '../operator/guards/roles.guard';
import { ActivityTimelineService } from './activity-timeline.service';
import { NotificationInboxService } from './notification-inbox.service';

@ApiTags('operator-notifications')
@ApiBearerAuth()
@Controller('v1/operator')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly inbox: NotificationInboxService,
    private readonly activity: ActivityTimelineService
  ) {}

  @Get('notifications')
  listNotifications(
    @Req() req: OperatorRequest,
    @Query('unreadOnly') unreadOnly?: string
  ) {
    return this.inbox.listNotifications(req.operatorUser, {
      unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
    });
  }

  @Patch('notifications/:id/read')
  markRead(@Req() req: OperatorRequest, @Param('id') id: string) {
    return this.inbox.markRead(req.operatorUser, id);
  }

  @Get('notification-preferences')
  getPreferences(@Req() req: OperatorRequest) {
    return this.inbox.getPreferences(req.operatorUser);
  }

  @Patch('notification-preferences')
  updatePreferences(
    @Req() req: OperatorRequest,
    @Body()
    body: {
      inAppEnabled?: boolean;
      emailEnabled?: boolean;
      quietHoursStart?: number | null;
      quietHoursEnd?: number | null;
      subscriptions?: { eventType: string; enabled: boolean }[];
    }
  ) {
    return this.inbox.updatePreferences(req.operatorUser, body);
  }

  @Get('activity')
  listActivity(
    @Req() req: OperatorRequest,
    @Query('incidentId') incidentId?: string,
    @Query('limit') limit?: string
  ) {
    return this.activity.listActivity(req.operatorUser, {
      incidentId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('activity/export')
  exportActivity(
    @Req() req: OperatorRequest,
    @Query('incidentId') incidentId?: string
  ) {
    return this.activity.exportAudit(req.operatorUser, { incidentId });
  }
}
