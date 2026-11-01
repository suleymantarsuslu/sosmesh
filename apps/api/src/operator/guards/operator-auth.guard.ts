import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { SESSION_COOKIE } from '../../auth/auth.constants';

export type OperatorJwtPayload = {
  sub: string;
  role: UserRole | string;
  teamId?: string;
  organizationId?: string;
};

export type OperatorRequestUser = {
  sub: string;
  role: UserRole;
  teamId?: string;
  organizationId?: string;
};

export type OperatorRequest = Request & {
  operatorUser: OperatorRequestUser;
};

@Injectable()
export class OperatorAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<OperatorRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Operator authentication required',
      });
    }
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Operator authentication required',
      });
    }
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as OperatorJwtPayload;
      request.operatorUser = {
        sub: payload.sub,
        role: payload.role as UserRole,
        teamId: payload.teamId,
        organizationId: payload.organizationId,
      };
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Operator authentication required',
      });
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    const cookies = request.cookies as Record<string, string> | undefined;
    if (cookies?.[SESSION_COOKIE]) {
      return cookies[SESSION_COOKIE];
    }
    return null;
  }
}
