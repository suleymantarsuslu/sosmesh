import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { LocationStatus, SosType } from '@prisma/client';

export class CreateOperatorMessageDto {
  @IsUUID()
  messageId!: string;

  @IsUUID()
  incidentId!: string;

  @IsOptional()
  @IsEnum(SosType)
  sosType?: SosType;

  @IsOptional()
  @IsEnum(LocationStatus)
  locationStatus?: LocationStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  personCount?: number;

  @IsOptional()
  @IsString()
  @MinLength(8)
  encryptedNoteBlob?: string;
}
