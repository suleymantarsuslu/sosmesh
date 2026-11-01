import { Injectable } from '@nestjs/common';

import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';
import { OperatorFeedEventDto, OperatorFeedService } from './operator-feed.service';

@Injectable()
export class OperatorEventsService {
  constructor(private readonly feed: OperatorFeedService) {}

  poll(
    user: OperatorRequestUser,
    afterSeq: bigint,
    limit: number
  ): Promise<OperatorFeedEventDto[]> {
    return this.feed.listAfter(user, afterSeq, limit);
  }
}
