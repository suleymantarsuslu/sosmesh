import { Injectable } from '@nestjs/common';

import { OperatorFeedEventDto, OperatorFeedService } from './operator-feed.service';

@Injectable()
export class OperatorEventsService {
  constructor(private readonly feed: OperatorFeedService) {}

  poll(afterSeq: bigint, limit: number): Promise<OperatorFeedEventDto[]> {
    return this.feed.listAfter(afterSeq, limit);
  }
}
