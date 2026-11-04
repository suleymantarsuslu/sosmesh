import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OperatorAuthGuard } from '../operator/guards/operator-auth.guard';
import { Roles } from '../operator/guards/roles.decorator';
import { RolesGuard } from '../operator/guards/roles.guard';
import { RegionsService, type RegionArea } from './regions.service';

@Controller('v1/operator/broadcasts/regions')
@UseGuards(OperatorAuthGuard, RolesGuard)
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get('countries')
  @Roles(UserRole.ADMIN)
  async getCountries(): Promise<RegionArea[]> {
    return this.regionsService.getCountries();
  }

  @Get('provinces')
  @Roles(UserRole.ADMIN)
  async getProvinces(@Query('countryOsmId') countryOsmId: string): Promise<RegionArea[]> {
    if (!countryOsmId) {
      return [];
    }
    return this.regionsService.getProvinces(countryOsmId);
  }

  @Get('districts')
  @Roles(UserRole.ADMIN)
  async getDistricts(@Query('provinceOsmId') provinceOsmId: string): Promise<RegionArea[]> {
    if (!provinceOsmId) {
      return [];
    }
    return this.regionsService.getDistricts(provinceOsmId);
  }

  @Get('neighborhoods')
  @Roles(UserRole.ADMIN)
  async getNeighborhoods(@Query('districtOsmId') districtOsmId: string): Promise<RegionArea[]> {
    if (!districtOsmId) {
      return [];
    }
    return this.regionsService.getNeighborhoods(districtOsmId);
  }

  @Get('streets')
  @Roles(UserRole.ADMIN)
  async getStreets(@Query('neighborhoodOsmId') neighborhoodOsmId: string): Promise<RegionArea[]> {
    if (!neighborhoodOsmId) {
      return [];
    }
    return this.regionsService.getStreets(neighborhoodOsmId);
  }
}
