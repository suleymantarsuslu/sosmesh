import { Module } from '@nestjs/common';

import { OperatorModule } from '../operator/operator.module';
import { AuthController } from './auth.controller';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';

@Module({
  imports: [OperatorModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRateLimitService],
  exports: [AuthService],
})
export class AuthModule {}
