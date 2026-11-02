import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { OperatorAuthGuard } from '../operator/guards/operator-auth.guard';
import { OperatorCsrfGuard } from '../operator/guards/operator-csrf.guard';
import { Roles } from '../operator/guards/roles.decorator';
import { RolesGuard } from '../operator/guards/roles.guard';
import { OperatorObservabilityService } from './operator-observability.service';

@ApiTags('operator')
@ApiBearerAuth()
@Controller('v1/operator/observability')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard, RolesGuard)
export class OperatorObservabilityController {
  constructor(private readonly observability: OperatorObservabilityService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  async summary() {
    return this.observability.getSummary();
  }

  @Get('audit')
  @Roles(UserRole.ADMIN)
  async auditTrail() {
    const items = await this.observability.listRecentAudit();
    return { items };
  }
}
