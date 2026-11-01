import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { IngestPacketService } from '../ingest/ingest-packet.service';
import { IngestService } from '../ingest/ingest.service';
import { MAX_INGEST_BATCH_BODY_BYTES } from '../ingest/ingest.constants';
import type {
  IngestBatchItemResultDto,
  IngestBatchRequestDto,
  IngestBatchResponseDto,
} from './dto/ingest-batch.dto';

@Injectable()
export class BatchIngestService {
  constructor(
    private readonly ingestService: IngestService,
    private readonly packetService: IngestPacketService
  ) {}

  async processBatch(
    dto: IngestBatchRequestDto,
    clientKey: string
  ): Promise<IngestBatchResponseDto> {
    const rawBodyBytes = Buffer.byteLength(JSON.stringify(dto), 'utf8');
    if (rawBodyBytes > MAX_INGEST_BATCH_BODY_BYTES) {
      throw new HttpException(
        {
          code: 'BATCH_TOO_LARGE',
          message: 'Batch body exceeds maximum allowed size',
        },
        HttpStatus.PAYLOAD_TOO_LARGE
      );
    }

    const results: IngestBatchItemResultDto[] = [];
    for (let index = 0; index < dto.items.length; index += 1) {
      const item = dto.items[index];
      const itemBytes = Buffer.byteLength(JSON.stringify(item), 'utf8');
      try {
        this.packetService.assertWithinSizeLimit(itemBytes);
        const receipt = await this.ingestService.processIngest(item, clientKey, itemBytes);
        results.push({ index, status: 'accepted', receipt: receipt.receipt });
      } catch (error) {
        results.push({ index, status: 'error', error: this.mapError(error) });
      }
    }
    return { results };
  }

  private mapError(error: unknown): {
    code: string;
    message: string;
    httpStatus: number;
  } {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const httpStatus = error.getStatus();
      if (typeof response === 'object' && response !== null) {
        const body = response as { code?: string; message?: string };
        return {
          code: body.code ?? 'HTTP_ERROR',
          message: body.message ?? error.message,
          httpStatus,
        };
      }
      return { code: 'HTTP_ERROR', message: error.message, httpStatus };
    }
    return {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected batch item failure',
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }
}
