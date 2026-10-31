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
  envelopeProfile?: 'gps' | 'unknown' | 'manual';
};

function applyEnvelopeProfile(
  base: Record<string, unknown>,
  profile: BuildIngestOptions['envelopeProfile']
): void {
  const envelope = base.envelope as Record<string, unknown>;
  if (profile === 'unknown') {
    envelope.locationStatus = 'UNKNOWN';
    envelope.location = null;
    return;
  }
  if (profile === 'manual') {
    envelope.locationStatus = 'MANUAL';
    envelope.location = {
      latitude: 41.015137,
      longitude: 28.97953,
      accuracy: 25,
    };
  }
}

export function buildValidIngestRequest(
  options: BuildIngestOptions = {}
): IngestRequestDto {
  const base = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
  const messageId =
    options.messageId ?? (base.id as string) ?? '550e8400-e29b-41d4-a716-446655440000';
  base.id = messageId;
  const envelope = base.envelope as Record<string, unknown>;
  envelope.timestamp = new Date(Date.now() - 30_000).toISOString();
  applyEnvelopeProfile(base, options.envelopeProfile);
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
