import type { TransportState } from './fixture-path';

export interface OutboxEntryMeta {
  sosId: string;
  digest: string;
  origin: string;
  encryptedBlobBase64: string;
  state: TransportState;
  retryAtMs: number;
  expiresAtMs: number;
  lastError: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface EnqueueInput {
  sosId: string;
  digest: string;
  origin: string;
  encryptedBlobBase64: string;
  retentionMs?: number;
}

/** Room-portable outbox persistence contract (Android Room target). */
export interface OutboxQueueAdapter {
  enqueue(input: EnqueueInput, nowMs: number): OutboxEntryMeta;
  getBySosId(sosId: string): OutboxEntryMeta | null;
  listAll(): OutboxEntryMeta[];
  updateState(
    sosId: string,
    state: TransportState,
    nowMs: number,
    lastError?: string | null
  ): OutboxEntryMeta | null;
  setRetryAt(sosId: string, retryAtMs: number, lastError: string | null): void;
  countDueForSend(nowMs: number, paused: boolean): number;
  purgeExpired(nowMs: number): number;
  close(): void;
}

export const DEFAULT_BACKOFF_MS = 60_000;
export const MAX_BACKOFF_MS = 3_600_000;

export function nextRetryAt(nowMs: number, attempt: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, DEFAULT_BACKOFF_MS * 2 ** Math.max(0, attempt - 1));
  return nowMs + exp;
}
