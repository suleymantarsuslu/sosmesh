import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ReceiptSignerService } from '../ingest/receipt-signer.service';

export const LOOKUP_MAX_ITEMS = 64;
/** Gateways set hopsLeft = maxHops (§6). */
export const TOMBSTONE_INITIAL_HOPS = 8;

export type LookupItem = { messageId: string; packetHash: string };
export type DeliveryTombstone = {
  ackType: 'SERVER_ACCEPTED';
  messageId: string;
  packetHash: string;
  timestamp: string;
  signature: string;
  hopsLeft: number;
};

export function parseLookupRequest(body: unknown): LookupItem[] {
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > LOOKUP_MAX_ITEMS) {
    throw new BadRequestException({ code: 'INVALID_LOOKUP', message: `items must contain 1..${LOOKUP_MAX_ITEMS} entries` });
  }
  return items.map((item) => {
    const i = item as Record<string, unknown> | null;
    const keys = i && typeof i === 'object' ? Object.keys(i) : [];
    if (
      !i ||
      keys.some((k) => k !== 'messageId' && k !== 'packetHash') ||
      typeof i.messageId !== 'string' ||
      i.messageId.length < 8 ||
      i.messageId.length > 64 ||
      typeof i.packetHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(i.packetHash)
    ) {
      throw new BadRequestException({ code: 'INVALID_LOOKUP', message: 'each item needs messageId and packetHash' });
    }
    return { messageId: i.messageId, packetHash: i.packetHash };
  });
}

/**
 * POST /v1/receipts/lookup (spec §6, §12). A receipt is returned only when BOTH messageId and the
 * stored packetHash match, so the endpoint cannot enumerate or list messages. Unknown items are omitted.
 */
@Injectable()
export class ReceiptsLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: ReceiptSignerService
  ) {}

  async lookup(items: LookupItem[]): Promise<{ receipts: DeliveryTombstone[] }> {
    const wanted = new Map(items.map((i) => [i.messageId, i.packetHash]));
    const rows = await this.prisma.sosMessage.findMany({
      where: { messageId: { in: [...wanted.keys()] } },
      select: { messageId: true, packetHash: true, serverReceiptAt: true, receivedAt: true },
    });
    const receipts = rows
      .filter((r) => r.packetHash !== null && wanted.get(r.messageId) === r.packetHash)
      .map((r) => {
        const at = r.serverReceiptAt ?? r.receivedAt;
        const packetHash = r.packetHash as string;
        return {
          ackType: 'SERVER_ACCEPTED' as const,
          messageId: r.messageId,
          packetHash,
          timestamp: at.toISOString(),
          signature: this.signer.signServerAccepted(r.messageId, packetHash, at),
          hopsLeft: TOMBSTONE_INITIAL_HOPS,
        };
      });
    return { receipts };
  }
}
