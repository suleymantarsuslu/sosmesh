import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { OperatorAuthGuard, OperatorRequest } from '../operator/guards/operator-auth.guard';
import { OperatorCsrfGuard } from '../operator/guards/operator-csrf.guard';
import { Roles } from '../operator/guards/roles.decorator';
import { RolesGuard } from '../operator/guards/roles.guard';
import { PrivacyEraseService } from './privacy-erase.service';
import { PrivacyExportService } from './privacy-export.service';
import { PrivacyRetentionService } from './privacy-retention.service';

@ApiTags('privacy')
@ApiBearerAuth()
@Controller('v1/operator/privacy')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard, RolesGuard)
export class PrivacyController {
  constructor(
    private readonly erase: PrivacyEraseService,
    private readonly exportBundle: PrivacyExportService,
    private readonly retention: PrivacyRetentionService
  ) {}

  @Post('incidents/:incidentId/erase')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  async eraseIncident(@Req() req: OperatorRequest, @Param('incidentId') incidentId: string) {
    return this.erase.eraseIncident(req.operatorUser, incidentId);
  }

  @Get('incidents/:incidentId/export')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  async exportIncident(@Req() req: OperatorRequest, @Param('incidentId') incidentId: string) {
    return this.exportBundle.exportIncident(req.operatorUser, incidentId);
  }

  @Post('retention/run')
  @Roles(UserRole.ADMIN)
  async runRetention(@Req() req: OperatorRequest) {
    return this.retention.purgeExpiredRecords(req.operatorUser.sub);
  }
}
