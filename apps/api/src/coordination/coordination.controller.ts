import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ResourceKind, WorkTaskStatus } from '@prisma/client';

import { OperatorAuthGuard, OperatorRequest } from '../operator/guards/operator-auth.guard';
import { OperatorCsrfGuard } from '../operator/guards/operator-csrf.guard';
import { RolesGuard } from '../operator/guards/roles.guard';
import { LocationShareService } from './location-share.service';
import { TeamsResourcesService } from './teams-resources.service';
import { WorkTaskService } from './work-task.service';

@ApiTags('operator-coordination')
@ApiBearerAuth()
@Controller('v1/operator')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard, RolesGuard)
export class CoordinationController {
  constructor(
    private readonly teams: TeamsResourcesService,
    private readonly tasks: WorkTaskService,
    private readonly locationShare: LocationShareService
  ) {}

  @Get('teams')
  listTeams(@Req() req: OperatorRequest) {
    return this.teams.listTeams(req.operatorUser);
  }

  @Get('resources')
  listResources(
    @Req() req: OperatorRequest,
    @Query('teamId') teamId?: string,
    @Query('kind') kind?: ResourceKind
  ) {
    return this.teams.listResources(req.operatorUser, { teamId, kind });
  }

  @Post('resources')
  upsertResource(
    @Req() req: OperatorRequest,
    @Body()
    body: {
      id?: string;
      teamId?: string;
      kind: ResourceKind;
      name: string;
      capacity: number;
      zoneCode?: string;
      availableFrom?: string;
      availableUntil?: string;
    }
  ) {
    return this.teams.upsertResource(req.operatorUser, body);
  }

  @Get('tasks')
  listTasks(
    @Req() req: OperatorRequest,
    @Query('incidentId') incidentId?: string,
    @Query('status') status?: WorkTaskStatus
  ) {
    return this.tasks.listTasks(req.operatorUser, { incidentId, status });
  }

  @Post('tasks')
  createTask(
    @Req() req: OperatorRequest,
    @Body()
    body: {
      incidentId: string;
      teamId: string;
      resourceId?: string;
      assigneeId?: string;
      title: string;
      description?: string;
    }
  ) {
    return this.tasks.createTask(req.operatorUser, body);
  }

  @Post('tasks/ai-draft')
  createAiDraft(
    @Req() req: OperatorRequest,
    @Body()
    body: {
      incidentId: string;
      teamId: string;
      resourceId?: string;
      title: string;
      description?: string;
    }
  ) {
    return this.tasks.createAiDraft(req.operatorUser, body);
  }

  @Patch('tasks/:taskId/assign')
  assignTask(
    @Req() req: OperatorRequest,
    @Param('taskId') taskId: string,
    @Body() body: { assigneeId: string; expectedVersion: number }
  ) {
    return this.tasks.assignTask(req.operatorUser, taskId, body);
  }

  @Patch('tasks/:taskId/accept')
  acceptTask(
    @Req() req: OperatorRequest,
    @Param('taskId') taskId: string,
    @Body() body: { expectedVersion: number }
  ) {
    return this.tasks.acceptTask(req.operatorUser, taskId, body);
  }

  @Patch('tasks/:taskId/withdraw')
  withdrawTask(
    @Req() req: OperatorRequest,
    @Param('taskId') taskId: string,
    @Body() body: { expectedVersion: number }
  ) {
    return this.tasks.withdrawTask(req.operatorUser, taskId, body);
  }

  @Patch('tasks/:taskId/close')
  closeTask(
    @Req() req: OperatorRequest,
    @Param('taskId') taskId: string,
    @Body() body: { expectedVersion: number }
  ) {
    return this.tasks.closeTask(req.operatorUser, taskId, body);
  }

  @Post('location-share')
  grantLocationShare(
    @Req() req: OperatorRequest,
    @Body()
    body: { expiresAt: string; latitude?: number; longitude?: number }
  ) {
    return this.locationShare.grantShare(req.operatorUser, body);
  }

  @Get('location-share/active')
  listActiveLocations(@Req() req: OperatorRequest) {
    return this.locationShare.listTeamLocations(req.operatorUser);
  }

  @Post('location-share/:grantId/revoke')
  revokeLocationShare(@Req() req: OperatorRequest, @Param('grantId') grantId: string) {
    return this.locationShare.revokeShare(req.operatorUser, grantId);
  }
}
