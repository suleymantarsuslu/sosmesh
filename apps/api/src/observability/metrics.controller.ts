import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { SosMeshMetricsService } from './sosmesh-metrics.service';

@ApiExcludeController()
@Controller()
export class MetricsController {
  constructor(private readonly metrics: SosMeshMetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metricsText(): string {
    return this.metrics.renderPrometheusText();
  }
}
