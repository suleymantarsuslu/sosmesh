import { IsArray, IsString, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RelayDeliveryStatusRequestDto {
  @ApiProperty({
    description: 'Array of message IDs to check delivery status (max 200)',
    type: [String],
    maxItems: 200,
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  messageIds: string[];
}

export class RelayDeliveryStatusResponseDto {
  @ApiProperty({
    description: 'Array of message IDs that have been delivered to the server',
    type: [String],
  })
  delivered: string[];
}
