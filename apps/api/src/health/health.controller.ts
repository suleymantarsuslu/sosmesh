import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service';
import { SosMeshMetricsService } from '../observability/sosmesh-metrics.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: SosMeshMetricsService
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.metrics.setDatabaseUp(true);
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'up',
      };
    } catch {
      this.metrics.setDatabaseUp(false);
      throw new ServiceUnavailableException({
        code: 'NOT_READY',
        message: 'Database unavailable',
      });
    }
  }
}
