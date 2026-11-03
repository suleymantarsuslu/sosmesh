import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { securityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { bootstrapOpenTelemetry } from './observability/otel-tracing';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.use(securityHeadersMiddleware);

  const configService = app.get(ConfigService);
  
  const trustProxy = configService.get<string>('TRUST_PROXY');
  if (trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance();
    const numericHops = Number(trustProxy);
    if (!isNaN(numericHops) && numericHops > 0) {
      expressApp.set('trust proxy', numericHops);
    } else if (trustProxy.toLowerCase() === 'true') {
      expressApp.set('trust proxy', true);
    } else if (trustProxy.includes('/') || trustProxy.includes(',')) {
      expressApp.set('trust proxy', trustProxy.split(',').map((s) => s.trim()));
    }
  }

  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  if (corsOrigins) {
    app.enableCors({
      origin: corsOrigins.split(',').map((o) => o.trim()),
      credentials: true,
    });
  }

  const config = new DocumentBuilder()
    .setTitle('SOSMesh API')
    .setDescription('Emergency mesh network API — public and operator surfaces')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  return { app, document };
}

async function bootstrap() {
  bootstrapOpenTelemetry('sosmesh-api');
  const { app } = await createApp();
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0');
  const logger = app.get(Logger);
  logger.log(`SOSMesh API listening on port ${port}`);
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
