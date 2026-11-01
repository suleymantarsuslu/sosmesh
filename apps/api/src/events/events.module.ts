import { Module } from '@nestjs/common';

import { OperatorEventsController } from './operator-events.controller';
import { OperatorEventsService } from './operator-events.service';
import { OperatorFeedService } from './operator-feed.service';

@Module({
  controllers: [OperatorEventsController],
  providers: [OperatorFeedService, OperatorEventsService],
  exports: [OperatorFeedService],
})
export class EventsModule {}
