import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export enum BroadcastSeverity {
  info = 'info',
  warning = 'warning',
  critical = 'critical',
}

export enum BroadcastKind {
  standard = 'standard',
  relay_request = 'relay_request',
}

export type SelectedRegion = {
  label: string;
  lat: number;
  lon: number;
  boundingBox: [number, number, number, number];
};

export class CreateBroadcastDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;

  @IsEnum(BroadcastSeverity)
  severity!: BroadcastSeverity;

  @IsOptional()
  @IsEnum(BroadcastKind)
  kind?: BroadcastKind;

  @IsNumber()
  @Min(1)
  @Max(168)
  expiryHours!: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  regionLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  regionLongitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10000)
  regionRadiusKm?: number;

  @IsOptional()
  selectedRegion?: SelectedRegion;
}
