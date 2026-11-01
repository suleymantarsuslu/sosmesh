import { Injectable } from '@nestjs/common';

import { TenantScopeService } from './tenant-scope.service';

/** Stable injection token used by operator and events modules. */
@Injectable()
export class IncidentScopeService extends TenantScopeService {}
