import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import {
  OperatorAuthGuard,
  OperatorRequest,
} from '../operator/guards/operator-auth.guard';
import { OperatorCsrfGuard } from '../operator/guards/operator-csrf.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SESSION_COOKIE } from './auth.constants';
import { getClientKey } from '../common/utils/client-ip.util';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const clientKey = getClientKey(req);
    const result = await this.auth.login(dto, clientKey);
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
    return { user: result.user, token: result.token };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OperatorCsrfGuard)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(OperatorAuthGuard)
  async me(@Req() req: OperatorRequest) {
    const profile = await this.auth.getProfile(req.operatorUser.sub);
    if (!profile) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Operator authentication required',
      });
    }
    return { user: profile };
  }
}

