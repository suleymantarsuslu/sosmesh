import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { OperatorAuthGuard, OperatorRequest } from '../operator/guards/operator-auth.guard';
import { OperatorCsrfGuard } from '../operator/guards/operator-csrf.guard';
import { RolesGuard } from '../operator/guards/roles.guard';
import { OrganizationService } from './organization.service';

@ApiTags('organization')
@ApiBearerAuth()
@Controller('v1/operator/organization')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get('context')
  async context(@Req() req: OperatorRequest) {
    return this.organization.getOperatorContext(req.operatorUser);
  }
}
