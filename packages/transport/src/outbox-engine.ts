import { DeliveryStateMachine } from './state-machine';
import type { IClock } from './clock';
import { SystemClock } from './clock';
import type { OutboxQueueAdapter, EnqueueInput } from './outbox-types';
import { nextRetryAt } from './outbox-types';
import type { TransportState } from './fixture-path';

export interface OutboxEngineOptions {
  queue: OutboxQueueAdapter;
  clock?: IClock;
  stateMachine?: DeliveryStateMachine;
}

export class OutboxEngine {
  private readonly queue: OutboxQueueAdapter;
  private readonly clock: IClock;
  private readonly stateMachine: DeliveryStateMachine;
  private paused = false;
  private sendAttempts = 0;

  constructor(options: OutboxEngineOptions) {
    this.queue = options.queue;
    this.clock = options.clock ?? new SystemClock();
    this.stateMachine = options.stateMachine ?? new DeliveryStateMachine();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  saveLocal(input: EnqueueInput) {
    const now = this.clock.nowMs();
    this.queue.purgeExpired(now);
    return this.queue.enqueue(input, now);
  }

  advanceState(sosId: string, to: TransportState) {
    const entry = this.queue.getBySosId(sosId);
    if (!entry) {
      throw new Error(`Unknown SOS id: ${sosId}`);
    }
    const next = this.stateMachine.transition(entry.state, to);
    return this.queue.updateState(sosId, next, this.clock.nowMs());
  }

  recordSendFailure(sosId: string, errorMessage: string, attempt: number): void {
    this.sendAttempts += 1;
    const retryAt = nextRetryAt(this.clock.nowMs(), attempt);
    this.queue.setRetryAt(sosId, retryAt, errorMessage);
  }

  countSendAttemptsDue(): number {
    return this.queue.countDueForSend(this.clock.nowMs(), this.paused);
  }

  getSendAttemptsCounter(): number {
    return this.sendAttempts;
  }

  simulateReboot(): void {
    this.queue.close();
  }
}
