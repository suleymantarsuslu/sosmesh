import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import {
  HttpExceptionFilter,
  ValidationExceptionFilter,
} from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { envValidationSchema } from './config/env.schema';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { IngestModule } from './ingest/ingest.module';
import { EventsModule } from './events/events.module';
import { SyncModule } from './sync/sync.module';
import { OperatorModule } from './operator/operator.module';
import { OrganizationModule } from './organization/organization.module';
import { CoordinationModule } from './coordination/coordination.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { PrivacyModule } from './privacy/privacy.module';
import { RecommendationModule } from './recommendation/recommendation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.encryptedNoteBlob',
            'req.body.encryptedPayload',
            'req.body.sosMessage.encryptedPayload',
            'req.body.sosMessage.envelope.location',
            'req.body.longitude',
            'req.body.note',
            'req.body.coordinates',
          ],
          remove: true,
        },
        serializers: {
          req(req) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              headers: {
                'x-request-id': req.headers['x-request-id'],
              },
            };
          },
        },
      },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    PublicModule,
    IngestModule,
    SyncModule,
    EventsModule,
    OperatorModule,
    OrganizationModule,
    CoordinationModule,
    NotificationsModule,
    PrivacyModule,
    RecommendationModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: ValidationExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
