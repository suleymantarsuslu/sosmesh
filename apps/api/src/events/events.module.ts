import { Module } from '@nestjs/common';

import { OperatorModule } from '../operator/operator.module';
import { OperatorCaseEventsController } from './operator-case-events.controller';
import { OperatorEventsController } from './operator-events.controller';
import { OperatorEventsService } from './operator-events.service';
import { OperatorFeedService } from './operator-feed.service';

@Module({
  imports: [OperatorModule],
  controllers: [OperatorEventsController, OperatorCaseEventsController],
  providers: [OperatorFeedService, OperatorEventsService],
  exports: [OperatorFeedService],
})
export class EventsModule {}
