import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

export type OperatorJwtPayload = {
  sub: string;
  role: string;
};

@Injectable()
export class OperatorAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Operator authentication required',
      });
    }
    const token = header.slice('Bearer '.length);
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Operator authentication required',
      });
    }
    try {
      jwt.verify(token, secret) as OperatorJwtPayload;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Operator authentication required',
      });
    }
  }
}
