import {
  MockChannel,
  MockChannelConfig,
  MockTransport,
} from '@sosmesh/ble-protocol';
import type { IClock } from '@sosmesh/ble-protocol';
import { MessageType } from '@sosmesh/ble-protocol';

import type { SeededRNG } from './seeded-rng';

export interface ChaosChannelConfig extends MockChannelConfig {
  /** Probability [0,1] that a packet is truncated before delivery. */
  partialWriteRate: number;
  /** When set, corrupts a random byte in ~partialCorruptRate of packets. */
  partialCorruptRate?: number;
}

export const DEFAULT_CHAOS_30PCT: ChaosChannelConfig = {
  packetLoss: 0.3,
  duplicateRate: 0.08,
  reorderRate: 0.12,
  minLatency: 5,
  maxLatency: 40,
  partialWriteRate: 0.05,
  partialCorruptRate: 0.02,
};

export const MTU_23_BLE: ChaosChannelConfig = {
  packetLoss: 0,
  duplicateRate: 0,
  reorderRate: 0,
  minLatency: 2,
  maxLatency: 8,
  partialWriteRate: 0,
};

export type ChaosChannel = MockChannel & {
  mutatePayload(data: Buffer): Buffer;
};

function mutatePayload(data: Buffer, chaos: ChaosChannelConfig, rng: SeededRNG): Buffer {
  let out = data;

  if (
    chaos.partialCorruptRate !== undefined &&
    chaos.partialCorruptRate > 0 &&
    rng.random() < chaos.partialCorruptRate &&
    out.length > 4
  ) {
    out = Buffer.from(out);
    const idx = 1 + Math.floor(rng.random() * (out.length - 2));
    out[idx] = out[idx] ^ 0xff;
  }

  if (chaos.partialWriteRate > 0 && rng.random() < chaos.partialWriteRate) {
    if (out.length > 8) {
      const keep = 4 + Math.floor(rng.random() * (out.length - 5));
      out = out.subarray(0, keep);
    }
  }

  return out;
}

export function createChaosTransportPair(
  config: ChaosChannelConfig,
  rng: SeededRNG,
  clock: IClock
): {
  senderTransport: MockTransport;
  receiverTransport: MockTransport;
  channel: MockChannel;
  clock: IClock;
} {
  let channelRef: MockChannel | null = null;

  const senderTransport = new MockTransport('sender', (data: Buffer) => {
    if (channelRef) {
      channelRef.sendFromSender(mutatePayload(data, config, rng));
    }
  });

  const receiverTransport = new MockTransport('receiver', (data: Buffer) => {
    if (channelRef) {
      channelRef.sendFromReceiver(mutatePayload(data, config, rng));
    }
  });

  channelRef = new MockChannel(config, senderTransport, receiverTransport, rng, clock);

  return {
    senderTransport,
    receiverTransport,
    channel: channelRef,
    clock,
  };
}

export function isAckToSender(data: Buffer): boolean {
  return data.length >= 1 && data.readUInt8(0) === MessageType.ACK;
}
