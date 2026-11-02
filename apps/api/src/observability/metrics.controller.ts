import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { MetricsScrapeGuard } from './metrics-scrape.guard';
import { SosMeshMetricsService } from './sosmesh-metrics.service';

@ApiExcludeController()
@UseGuards(MetricsScrapeGuard)
@Controller()
export class MetricsController {
  constructor(private readonly metrics: SosMeshMetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metricsText(): string {
    return this.metrics.renderPrometheusText();
  }
}
