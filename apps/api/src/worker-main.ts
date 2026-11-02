import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import * as http from 'http';

import { AppModule } from './app.module';
import { PrivacyRetentionService } from './privacy/privacy-retention.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const retention = app.get(PrivacyRetentionService);
  const logger = app.get(Logger);

  const port = Number(process.env.WORKER_HEALTH_PORT ?? 3002);
  const intervalMs = Number(process.env.WORKER_RETENTION_INTERVAL_MS ?? 3_600_000);

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/health/ready') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', role: 'worker', timestamp: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(port, '0.0.0.0', () => resolve());
  });

  const runRetention = async () => {
    const result = await retention.purgeExpiredRecords(null);
    logger.log({ result }, 'Retention worker tick');
  };

  await runRetention();
  setInterval(() => {
    void runRetention();
  }, intervalMs);

  logger.log(`SOSMesh worker listening for health on port ${port}`);
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
