import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  ValidateNested,
} from 'class-validator';

import { IngestRequestDto, IngestReceiptDto } from '../../ingest/dto/ingest-request.dto';
import { MAX_INGEST_BATCH_ITEMS } from '../../ingest/ingest.constants';

export class IngestBatchRequestDto {
  @IsArray()
  @ArrayMaxSize(MAX_INGEST_BATCH_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => IngestRequestDto)
  items!: IngestRequestDto[];
}

export class IngestBatchItemResultDto {
  index!: number;
  status!: 'accepted' | 'error';
  receipt?: IngestReceiptDto;
  error?: {
    code: string;
    message: string;
    httpStatus: number;
  };
}

export class IngestBatchResponseDto {
  results!: IngestBatchItemResultDto[];
}
