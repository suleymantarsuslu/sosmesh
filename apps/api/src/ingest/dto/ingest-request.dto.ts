import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class IngestRelayInfoDto {
  @ApiProperty({ example: 'a'.repeat(64) })
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  @Matches(/^[a-f0-9]{64}$/)
  relayId!: string;

  @IsInt()
  @Min(0)
  @Max(32)
  hopCount!: number;

  @IsISO8601()
  relayTimestamp!: string;
}

export class IngestTransportDto {
  @IsInt()
  @Min(1)
  @Max(86400)
  ttlSeconds!: number;

  @IsString()
  @MinLength(64)
  @MaxLength(64)
  @Matches(/^[a-f0-9]{64}$/)
  packetHash!: string;
}

export class IngestRequestDto {
  @IsObject()
  sosMessage!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => IngestRelayInfoDto)
  relayInfo!: IngestRelayInfoDto;

  @ValidateNested()
  @Type(() => IngestTransportDto)
  transport!: IngestTransportDto;
}

export class IngestReceiptDto {
  ackType!: 'SERVER_ACCEPTED';
  messageId!: string;
  packetHash!: string;
  timestamp!: string;
  signature!: string;
  uploadToken?: string;
}

export class IngestResponseDto {
  @ApiProperty()
  receipt!: IngestReceiptDto;

  /** Mesh v2: true when the message was merged into the sender's open incident. Absent for v1 inners. */
  @ApiProperty({ required: false })
  merged?: boolean;
}
