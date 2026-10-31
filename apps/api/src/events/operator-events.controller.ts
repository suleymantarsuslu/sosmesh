import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { OperatorAuthGuard } from '../operator/guards/operator-auth.guard';
import { OperatorEventsService } from './operator-events.service';

function parseAfterSeq(raw: string | undefined, headerLastEventId: string | undefined): bigint {
  const candidate = raw ?? headerLastEventId ?? '0';
  if (!/^\d+$/.test(candidate)) {
    return 0n;
  }
  return BigInt(candidate);
}

@ApiTags('operator')
@ApiBearerAuth()
@Controller('v1/operator')
@UseGuards(OperatorAuthGuard)
export class OperatorEventsController {
  constructor(private readonly operatorEvents: OperatorEventsService) {}

  @Get('events')
  async listEvents(
    @Query('after') after: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const afterSeq = parseAfterSeq(after, req.headers['last-event-id'] as string | undefined);
    const accept = req.headers.accept ?? '';
    if (accept.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let cursor = afterSeq;
      const writeBatch = async (): Promise<void> => {
        const batch = await this.operatorEvents.poll(cursor, 50);
        for (const event of batch) {
          cursor = BigInt(event.id);
          res.write(`id: ${event.id}\n`);
          res.write('event: incident_message\n');
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      };

      await writeBatch();
      const timer = setInterval(() => {
        writeBatch().catch(() => {
          clearInterval(timer);
          res.end();
        });
      }, 1_000);

      req.on('close', () => {
        clearInterval(timer);
        res.end();
      });
      return;
    }

    const events = await this.operatorEvents.poll(afterSeq, 100);
    res.json({ events });
  }
}
