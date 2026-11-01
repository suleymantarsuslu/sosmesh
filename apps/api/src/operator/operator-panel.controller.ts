import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { buildPaginated, parsePagination } from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { OperatorAuthGuard, OperatorRequest } from './guards/operator-auth.guard';
import { OperatorCsrfGuard } from './guards/operator-csrf.guard';
import { Roles } from './guards/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorDashboardService } from './operator-dashboard.service';
import { OperatorCasesService } from './operator-cases.service';
import {
  parseListOperatorCasesQuery,
} from './dto/list-operator-cases.query';

@ApiTags('operator')
@ApiBearerAuth()
@Controller('v1/operator')
@UseGuards(OperatorAuthGuard, OperatorCsrfGuard, RolesGuard)
export class OperatorPanelController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService,
    private readonly dashboard: OperatorDashboardService,
    private readonly cases: OperatorCasesService
  ) {}

  @Get('dashboard/stats')
  async dashboardStats(@Req() req: OperatorRequest) {
    return this.dashboard.getStats(req.operatorUser);
  }

  @Get('incidents')
  async listIncidents(
    @Req() req: OperatorRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    const pagination = parsePagination({
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
    const scopeWhere = this.scope.incidentWhere(req.operatorUser);
    const rows = await this.prisma.incident.findMany({
      where: scopeWhere,
      take: pagination.limit + 1,
      ...(pagination.cursor
        ? { skip: 1, cursor: { id: pagination.cursor } }
        : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return buildPaginated(rows, pagination.limit);
  }

  @Get('cases')
  async listCases(
    @Req() req: OperatorRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('incidentState') incidentState?: string,
    @Query('deliveryState') deliveryState?: string,
    @Query('locationStatus') locationStatus?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('accuracyMin') accuracyMin?: string,
    @Query('accuracyMax') accuracyMax?: string,
    @Query('search') search?: string
  ) {
    const query = parseListOperatorCasesQuery({
      cursor,
      limit,
      category,
      incidentState,
      deliveryState,
      locationStatus,
      source,
      from,
      to,
      accuracyMin,
      accuracyMax,
      search,
    });
    return this.cases.listCases(req.operatorUser, query);
  }

  @Get('cases/:incidentId')
  async getCase(@Req() req: OperatorRequest, @Param('incidentId') incidentId: string) {
    const detail = await this.cases.getCaseDetail(req.operatorUser, incidentId);
    if (!detail) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Case not found',
      });
    }
    return detail;
  }

  @Get('incidents/:id')
  async getIncident(@Req() req: OperatorRequest, @Param('id') id: string) {
    const allowed = await this.scope.canAccessIncident(req.operatorUser, id, this.prisma);
    if (!allowed) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Incident not found',
      });
    }
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      select: {
        id: true,
        state: true,
        createdAt: true,
        updatedAt: true,
        sosMessages: {
          select: {
            id: true,
            messageId: true,
            deliveryState: true,
            priority: true,
            locationStatus: true,
            receivedAt: true,
          },
          orderBy: { receivedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!incident) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Incident not found',
      });
    }
    return incident;
  }

  @Get('admin/users')
  @Roles(UserRole.ADMIN)
  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        teamId: true,
      },
      orderBy: { email: 'asc' },
      take: 100,
    });
    return { items: users };
  }
}
