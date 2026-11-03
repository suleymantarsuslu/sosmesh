import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { TeamStatus, TeamType } from './create-team.dto';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(TeamType)
  type?: TeamType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactInfo?: string;

  @IsOptional()
  @IsEnum(TeamStatus)
  status?: TeamStatus;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  zoneCode?: string;
}
