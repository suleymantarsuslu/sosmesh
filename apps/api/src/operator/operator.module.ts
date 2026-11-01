import { Module } from '@nestjs/common';

import { OrganizationModule } from '../organization/organization.module';
import { OperatorController } from './operator.controller';
import { OperatorPanelController } from './operator-panel.controller';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { OperatorCsrfGuard } from './guards/operator-csrf.guard';
import { RolesGuard } from './guards/roles.guard';
import { OperatorDashboardService } from './operator-dashboard.service';
import { OperatorCasesService } from './operator-cases.service';
import { OperatorCaseActionsService } from './operator-case-actions.service';

@Module({
  imports: [OrganizationModule],
  controllers: [OperatorController, OperatorPanelController],
  providers: [
    OperatorAuthGuard,
    OperatorCsrfGuard,
    RolesGuard,
    OperatorDashboardService,
    OperatorCasesService,
    OperatorCaseActionsService,
  ],
  exports: [
    OrganizationModule,
    OperatorAuthGuard,
    OperatorCsrfGuard,
    OperatorCasesService,
    OperatorCaseActionsService,
  ],
})
export class OperatorModule {}
