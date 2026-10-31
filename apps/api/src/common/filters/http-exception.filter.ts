import {
  BadRequestException,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
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
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(body);
      return;
    }

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
