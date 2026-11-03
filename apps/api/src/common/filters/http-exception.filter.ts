import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

import { SosMeshMetricsService } from '../../observability/sosmesh-metrics.service';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly metrics: SosMeshMetricsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const requestId = request.headers[REQUEST_ID_HEADER] as string | undefined;
    const path = request.path;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error({
        message: 'Prisma known request error',
        errorClass: 'PrismaClientKnownRequestError',
        prismaCode: exception.code,
        modelName: exception.meta?.modelName,
        columnName: exception.meta?.column_name,
        target: exception.meta?.target,
        path,
        requestId,
      });

      if (exception.code === 'P2002') {
        const conflict = new ConflictException({
          code: 'DUPLICATE_MESSAGE_ID',
          message: 'message_id already exists',
        });
        const status = conflict.getStatus();
        const body = conflict.getResponse();
        response.status(status).json(body);
        return;
      }

      this.metrics.recordHttpStatus(HttpStatus.INTERNAL_SERVER_ERROR);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.error({
        message: 'Prisma validation error (query args redacted for PII safety)',
        errorClass: 'PrismaClientValidationError',
        hint: 'Check Prisma schema for type mismatches or missing fields',
        path,
        requestId,
      });

      this.metrics.recordHttpStatus(HttpStatus.INTERNAL_SERVER_ERROR);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      this.logger.error({
        message: 'Prisma initialization error (connection details redacted)',
        errorClass: 'PrismaClientInitializationError',
        hint: 'Check DATABASE_URL and database connectivity',
        path,
        requestId,
      });

      this.metrics.recordHttpStatus(HttpStatus.INTERNAL_SERVER_ERROR);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.metrics.recordHttpStatus(status);
      const body = exception.getResponse();
      response.status(status).json(body);
      return;
    }

    this.logger.error({
      message: 'Unhandled exception',
      errorClass: exception?.constructor?.name || 'Unknown',
      errorMessage: exception instanceof Error ? exception.message : String(exception),
      path,
      requestId,
    });

    this.metrics.recordHttpStatus(HttpStatus.INTERNAL_SERVER_ERROR);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
    });
  }
}

export function mapValidationErrors(
  messages: string[]
): { code: string; message: string } {
  return {
    code: 'VALIDATION_ERROR',
    message: messages.join('; '),
  };
}

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === 'object' && payload !== null && 'code' in payload) {
      response.status(status).json(payload);
      return;
    }
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const message = (payload as { message: string | string[] }).message;
      const messages = Array.isArray(message) ? message : [message];
      response.status(status).json(mapValidationErrors(messages));
      return;
    }
    response.status(status).json({
      code: 'VALIDATION_ERROR',
      message: exception.message,
    });
  }
}
