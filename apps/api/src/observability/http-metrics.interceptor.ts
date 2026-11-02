import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { Request, Response } from 'express';
import { Observable, tap, catchError, throwError } from 'rxjs';

import { correlationIdFromRequest, runWithCorrelation } from './correlation-context.util';
import { SosMeshMetricsService } from './sosmesh-metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: SosMeshMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const started = process.hrtime.bigint();
    const correlationId = correlationIdFromRequest(req);
    const route = normalizeRoute(req);
    const tracer = trace.getTracer('sosmesh-http');

    return runWithCorrelation(correlationId, () =>
      tracer.startActiveSpan(`${req.method} ${route}`, (span) => {
        span.setAttribute('correlation_id', correlationId);
        span.setAttribute('http.route', route);
        const stream = next.handle().pipe(
          tap(() => {
            const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
            const status = res.statusCode || 200;
            this.metrics.recordHttpStatus(status);
            this.metrics.observeHttpDuration(route, elapsedMs / 1000);
            span.setAttribute('http.status_code', status);
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
          }),
          catchError((error) => {
            const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
            const status = typeof error?.status === 'number' ? error.status : 500;
            this.metrics.recordHttpStatus(status);
            this.metrics.observeHttpDuration(route, elapsedMs / 1000);
            span.recordException(error instanceof Error ? error : new Error(String(error)));
            span.setStatus({ code: SpanStatusCode.ERROR });
            span.end();
            return throwError(() => error);
          })
        );
        return stream;
      })
    );
  }
}

function normalizeRoute(req: Request): string {
  if (req.route?.path) {
    return String(req.route.path);
  }
  const path = req.path ?? req.url ?? 'unknown';
  if (path.startsWith('/v1/ingest')) {
    return '/v1/ingest';
  }
  if (path.startsWith('/health')) {
    return path.split('?')[0] ?? '/health';
  }
  return path.split('?')[0] ?? 'unknown';
}
