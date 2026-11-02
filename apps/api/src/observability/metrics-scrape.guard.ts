import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class MetricsScrapeGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('METRICS_SCRAPE_AUTH');
    if (!expected || expected.length < 16) {
      throw new UnauthorizedException({
        code: 'METRICS_SCRAPE_FORBIDDEN',
        message: 'Metrics scrape token is not configured',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'METRICS_SCRAPE_UNAUTHORIZED',
        message: 'Bearer token required for /metrics',
      });
    }

    const provided = header.slice('Bearer '.length);
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException({
        code: 'METRICS_SCRAPE_UNAUTHORIZED',
        message: 'Invalid metrics scrape token',
      });
    }
    return true;
  }
}
