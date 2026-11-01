import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type WindowCounter = {
  count: number;
  windowStartMs: number;
};

const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_MS = 60_000;

@Injectable()
export class AuthRateLimitService {
  private readonly counters = new Map<string, WindowCounter>();

  assertAllowed(clientKey: string): void {
    const maxRequests = Number(process.env.AUTH_RATE_LIMIT_MAX ?? DEFAULT_MAX);
    const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? DEFAULT_WINDOW_MS);
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
          message: 'Too many login attempts. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }
}
