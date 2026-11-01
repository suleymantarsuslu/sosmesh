import { Module } from '@nestjs/common';

import { OperatorController } from './operator.controller';
import { OperatorPanelController } from './operator-panel.controller';
import { IncidentScopeService } from './incident-scope.service';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { OperatorCsrfGuard } from './guards/operator-csrf.guard';
import { RolesGuard } from './guards/roles.guard';
import { OperatorDashboardService } from './operator-dashboard.service';
import { OperatorCasesService } from './operator-cases.service';
import { OperatorCaseActionsService } from './operator-case-actions.service';

@Module({
  controllers: [OperatorController, OperatorPanelController],
  providers: [
    OperatorAuthGuard,
    OperatorCsrfGuard,
    RolesGuard,
    IncidentScopeService,
    OperatorDashboardService,
    OperatorCasesService,
    OperatorCaseActionsService,
  ],
  exports: [
    OperatorAuthGuard,
    OperatorCsrfGuard,
    IncidentScopeService,
    OperatorCasesService,
    OperatorCaseActionsService,
  ],
})
export class OperatorModule {}
