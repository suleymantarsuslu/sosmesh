import { Injectable, Logger } from '@nestjs/common';

import { buildStructuredEvent } from './redact-log-fields.util';
import { getCorrelationId } from './correlation-context.util';

@Injectable()
export class StructuredEventLogger {
  private readonly logger = new Logger('SosMeshEvent');

  emit(name: string, fields: Record<string, unknown> = {}): void {
    const correlationId = getCorrelationId() ?? 'no-correlation';
    const payload = buildStructuredEvent(name, correlationId, fields);
    this.logger.log(JSON.stringify(payload));
  }
}
