import { trace, SpanStatusCode, type Span } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let provider: NodeTracerProvider | null = null;

export function isOtelExportEnabled(): boolean {
  return process.env.OTEL_EXPORTER_OTLP_ENABLED === 'true';
}

export function bootstrapOpenTelemetry(serviceName = 'sosmesh-api'): void {
  if (provider) {
    return;
  }
  process.env.OTEL_SERVICE_NAME = serviceName;
  if (isOtelExportEnabled()) {
    process.env.OTEL_TRACES_EXPORTER = 'otlp';
    if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://127.0.0.1:4318';
    }
  } else {
    process.env.OTEL_TRACES_EXPORTER = 'none';
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
  });
  provider = new NodeTracerProvider({ resource });
  provider.register();
}

export function shutdownOpenTelemetry(): Promise<void> {
  if (!provider) {
    return Promise.resolve();
  }
  const current = provider;
  provider = null;
  return current.shutdown();
}

export async function withWorkerSpan<T>(
  name: string,
  correlationId: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = trace.getTracer('sosmesh-worker');
  return tracer.startActiveSpan(name, async (span) => {
    span.setAttribute('correlation_id', correlationId);
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'worker_error',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
