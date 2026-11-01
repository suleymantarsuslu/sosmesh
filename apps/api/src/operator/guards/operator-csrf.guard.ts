import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { SESSION_COOKIE } from '../../auth/auth.constants';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class OperatorCsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!STATE_CHANGING.has(request.method.toUpperCase())) {
      return true;
    }
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return true;
    }
    const cookies = request.cookies as Record<string, string> | undefined;
    if (!cookies?.[SESSION_COOKIE]) {
      return true;
    }
    const origin = request.headers.origin;
    const allowedRaw = this.config.get<string>('CORS_ORIGINS') ?? '';
    const allowed = allowedRaw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!origin || !allowed.includes(origin)) {
      throw new ForbiddenException({
        code: 'CSRF_FORBIDDEN',
        message: 'Origin not allowed for cookie-authenticated request',
      });
    }
    return true;
  }
}
