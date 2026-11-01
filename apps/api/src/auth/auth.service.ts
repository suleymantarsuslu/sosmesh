import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';
import { OperatorJwtPayload } from '../operator/guards/operator-auth.guard';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { LoginDto } from './dto/login.dto';

export type AuthSessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  teamId: string | null;
  organizationId: string | null;
  organizationName: string | null;
};

export type LoginResult = {
  token: string;
  user: AuthSessionUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly rateLimit: AuthRateLimitService
  ) {}

  async login(dto: LoginDto, clientKey: string): Promise<LoginResult> {
    this.rateLimit.assertAllowed(clientKey);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        team: {
          select: {
            organizationId: true,
            organization: { select: { name: true } },
          },
        },
      },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const payload: OperatorJwtPayload = {
      sub: user.id,
      role: user.role,
      teamId: user.teamId ?? undefined,
      organizationId: user.team?.organizationId ?? undefined,
    };
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const token = sign(payload, secret, { expiresIn: '8h', algorithm: 'HS256' });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        teamId: user.teamId,
        organizationId: user.team?.organizationId ?? null,
        organizationName: user.team?.organization?.name ?? null,
      },
    };
  }

  async getProfile(userId: string): Promise<AuthSessionUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        team: {
          select: {
            organizationId: true,
            organization: { select: { name: true } },
          },
        },
      },
    });
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      teamId: user.teamId,
      organizationId: user.team?.organizationId ?? null,
      organizationName: user.team?.organization?.name ?? null,
    };
  }
}
