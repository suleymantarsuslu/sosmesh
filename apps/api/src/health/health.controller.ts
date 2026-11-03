import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service';
import { SosMeshMetricsService } from '../observability/sosmesh-metrics.service';
import type { MediaStorage } from '../media/media-storage.interface';
import { MEDIA_STORAGE } from '../media/media-storage.interface';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: SosMeshMetricsService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStorage & { getStorageHealth?: () => { healthy: boolean; error: { code: string; path: string; message: string } | null } }
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
    const storageHealth = this.mediaStorage.getStorageHealth?.() ?? { healthy: true, error: null };
    
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.metrics.setDatabaseUp(true);
      
      if (!storageHealth.healthy) {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          database: 'up',
          storage: 'down',
          details: storageHealth.error,
        };
      }
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'up',
        storage: 'up',
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
