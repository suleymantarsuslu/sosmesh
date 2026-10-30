import { OutboxEngine } from '@sosmesh/transport';
import type { EnqueueInput, OutboxEntryMeta, OutboxQueueAdapter } from '@sosmesh/transport';
import type { TransportState } from '@sosmesh/transport';

import { MeshTraceErrorClass, type MeshTraceTimelineEntry } from './trace-export';

class MemoryOutboxQueue implements OutboxQueueAdapter {
  private entries = new Map<string, OutboxEntryMeta>();

  enqueue(input: EnqueueInput, nowMs: number): OutboxEntryMeta {
    const entry: OutboxEntryMeta = {
      sosId: input.sosId,
      digest: input.digest,
      origin: input.origin,
      encryptedBlobBase64: input.encryptedBlobBase64,
      state: 'LOCAL_SAVED',
      retryAtMs: nowMs,
      expiresAtMs: nowMs + (input.retentionMs ?? 86_400_000),
      lastError: null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    this.entries.set(input.sosId, entry);
    return entry;
  }

  getBySosId(sosId: string): OutboxEntryMeta | null {
    return this.entries.get(sosId) ?? null;
  }

  listAll(): OutboxEntryMeta[] {
    return [...this.entries.values()];
  }

  updateState(
    sosId: string,
    state: TransportState,
    nowMs: number,
    lastError?: string | null
  ): OutboxEntryMeta | null {
    const entry = this.entries.get(sosId);
    if (!entry) {
      return null;
    }
    const next = { ...entry, state, updatedAtMs: nowMs, lastError: lastError ?? null };
    this.entries.set(sosId, next);
    return next;
  }

  setRetryAt(sosId: string, retryAtMs: number, lastError: string | null): void {
    const entry = this.entries.get(sosId);
    if (entry) {
      entry.retryAtMs = retryAtMs;
      entry.lastError = lastError;
    }
  }

  countDueForSend(nowMs: number, paused: boolean): number {
    if (paused) {
      return 0;
    }
    let count = 0;
    for (const entry of this.entries.values()) {
      if (entry.retryAtMs <= nowMs && entry.expiresAtMs > nowMs) {
        count += 1;
      }
    }
    return count;
  }

  purgeExpired(nowMs: number): number {
    let removed = 0;
    for (const [id, entry] of this.entries) {
      if (entry.expiresAtMs <= nowMs) {
        this.entries.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  close(): void {
    this.entries.clear();
  }
}

/** Simulates ADIM 10 low-battery pause: outbox send attempts blocked until unpaused. */
export function simulateLowBatteryPause(
  timeline: MeshTraceTimelineEntry[],
  t: number
): { pausedAttempts: number; resumedAttempts: number } {
  const queue = new MemoryOutboxQueue();
  const engine = new OutboxEngine({ queue });
  engine.saveLocal({
    sosId: 'lab-battery-1',
    digest: 'abc123',
    origin: 'lab-simulator',
    encryptedBlobBase64: Buffer.from('opaque-synthetic').toString('base64'),
    retentionMs: 86_400_000,
  });

  engine.setPaused(true);
  const pausedAttempts = engine.countSendAttemptsDue();
  timeline.push({
    t,
    node: 'outbox',
    kind: 'low_battery_pause',
    errorClass: MeshTraceErrorClass.OUTBOX_PAUSED,
  });

  engine.setPaused(false);
  const resumedAttempts = engine.countSendAttemptsDue();

  queue.close();
  return { pausedAttempts, resumedAttempts };
}
