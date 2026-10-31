import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { computePacketHash } from '../../src/ingest/ingest-packet.service';
import type { IngestRequestDto } from '../../src/ingest/dto/ingest-request.dto';

const fixturePath = join(
  __dirname,
  '../../../../packages/fixtures/protocol-v1/valid-sos.json'
);

export type BuildIngestOptions = {
  messageId?: string;
  relayId?: string;
  hopCount?: number;
  ttlSeconds?: number;
  mutate?: (message: Record<string, unknown>) => void;
};

export function buildValidIngestRequest(
  options: BuildIngestOptions = {}
): IngestRequestDto {
  const base = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
  const messageId =
    options.messageId ?? (base.id as string) ?? '550e8400-e29b-41d4-a716-446655440000';
  base.id = messageId;
  const envelope = base.envelope as Record<string, unknown>;
  envelope.timestamp = new Date(Date.now() - 30_000).toISOString();
  if (options.mutate) {
    options.mutate(base);
  }

  const sosMessage = base;
  const packetHash = computePacketHash(sosMessage);
  const relayId =
    options.relayId ??
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  return {
    sosMessage,
    relayInfo: {
      relayId,
      hopCount: options.hopCount ?? 1,
      relayTimestamp: new Date().toISOString(),
    },
    transport: {
      ttlSeconds: options.ttlSeconds ?? 86_400,
      packetHash,
    },
  };
}

export function relayIdFromSuffix(hexSuffix: string): string {
  const normalized = hexSuffix.padStart(64, 'a').slice(0, 64);
  return normalized;
}
