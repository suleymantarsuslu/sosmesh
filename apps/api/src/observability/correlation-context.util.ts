import { AsyncLocalStorage } from 'node:async_hooks';

import type { Request } from 'express';

import { REQUEST_ID_HEADER } from '../common/middleware/request-id.middleware';

export type CorrelationContext = {
  correlationId: string;
  spanName?: string;
};

const storage = new AsyncLocalStorage<CorrelationContext>();

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function runWithCorrelation<T>(
  correlationId: string,
  fn: () => T,
  spanName?: string
): T {
  return storage.run({ correlationId, spanName }, fn);
}

export function correlationIdFromRequest(req: Request): string {
  const fromReq = (req as Request & { requestId?: string }).requestId;
  if (fromReq) {
    return fromReq;
  }
  const header = req.headers[REQUEST_ID_HEADER];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return 'unknown-correlation';
}

export function getAsyncLocalStorageForTests(): AsyncLocalStorage<CorrelationContext> {
  return storage;
}
