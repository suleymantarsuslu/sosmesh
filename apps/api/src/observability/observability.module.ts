import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { OperatorObservabilityController } from './operator-observability.controller';
import { OperatorObservabilityService } from './operator-observability.service';
import { SosMeshMetricsService } from './sosmesh-metrics.service';
import { StructuredEventLogger } from './structured-event-logger.service';

@Global()
@Module({
  controllers: [MetricsController, OperatorObservabilityController],
  providers: [
    SosMeshMetricsService,
    StructuredEventLogger,
    OperatorObservabilityService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [SosMeshMetricsService, StructuredEventLogger, OperatorObservabilityService],
})
export class ObservabilityModule {}
