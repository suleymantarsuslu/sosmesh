import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

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
  const { app } = await createApp();
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`SOSMesh API listening on port ${port}`);
}

if (require.main === module) {
  bootstrap();
}
