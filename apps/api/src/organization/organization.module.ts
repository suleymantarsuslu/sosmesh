import { Module } from '@nestjs/common';

import { IncidentScopeService } from './incident-scope.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { TenantScopeService } from './tenant-scope.service';

@Module({
  controllers: [OrganizationController],
  providers: [TenantScopeService, IncidentScopeService, OrganizationService],
  exports: [TenantScopeService, IncidentScopeService, OrganizationService],
})
export class OrganizationModule {}
