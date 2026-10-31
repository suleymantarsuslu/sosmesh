import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
} from './ingest.constants';

type WindowCounter = {
  count: number;
  windowStartMs: number;
};

@Injectable()
export class IngestRateLimitService {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly counters = new Map<string, WindowCounter>();

  constructor(config: ConfigService) {
    this.maxRequests = config.get<number>(
      'INGEST_RATE_LIMIT_MAX',
      DEFAULT_RATE_LIMIT_MAX
    );
    this.windowMs = config.get<number>(
      'INGEST_RATE_LIMIT_WINDOW_MS',
      DEFAULT_RATE_LIMIT_WINDOW_MS
    );
  }

  assertAllowed(clientKey: string): void {
    const maxRequests = Number(
      process.env.INGEST_RATE_LIMIT_MAX ?? this.maxRequests
    );
    const windowMs = Number(
      process.env.INGEST_RATE_LIMIT_WINDOW_MS ?? this.windowMs
    );
    const now = Date.now();
    const existing = this.counters.get(clientKey);
    if (!existing || now - existing.windowStartMs >= windowMs) {
      this.counters.set(clientKey, { count: 1, windowStartMs: now });
      return;
    }
    existing.count += 1;
    if (existing.count > maxRequests) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Ingest rate limit exceeded for this client',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }
}
