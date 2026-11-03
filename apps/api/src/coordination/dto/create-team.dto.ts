import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export enum TeamType {
  MEDICAL = 'MEDICAL',
  SEARCH_RESCUE = 'SEARCH_RESCUE',
  FIRE = 'FIRE',
  POLICE = 'POLICE',
  TECHNICAL = 'TECHNICAL',
  LOGISTICS = 'LOGISTICS',
  GENERAL = 'GENERAL',
}

export enum TeamStatus {
  ACTIVE = 'ACTIVE',
  STANDBY = 'STANDBY',
  OFF_DUTY = 'OFF_DUTY',
}

export class CreateTeamDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

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

  @IsEnum(TeamStatus)
  status!: TeamStatus;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  zoneCode?: string;
}
