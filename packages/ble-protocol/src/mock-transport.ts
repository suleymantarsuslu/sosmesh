import { EventEmitter } from 'events';

import { ITransport, IRNG, SystemRNG, IClock, SystemClock } from './sender';
import { MessageType, CHUNK_HEADER_SIZE } from './types';

export interface MockChannelConfig {
  packetLoss: number; // 0.0 - 1.0
  duplicateRate: number; // 0.0 - 1.0
  reorderRate: number; // 0.0 - 1.0
  minLatency: number; // ms
  maxLatency: number; // ms
  disconnectAfter?: number; // ms, optional
}

export class MockTransport extends EventEmitter implements ITransport {
  private closed = false;

  constructor(
    private name: string,
    private sendFn: (data: Buffer) => void
  ) {
    super();
  }

  async send(data: Buffer): Promise<void> {
    if (this.closed) {
      throw new Error('Transport closed');
    }
    this.sendFn(data);
  }

  receiveData(data: Buffer): void {
    if (!this.closed) {
      this.emit('data', data);
    }
  }

  triggerDisconnect(): void {
    if (!this.closed) {
      this.emit('disconnect');
      this.closed = true;
    }
  }

  reconnect(): void {
    this.closed = false;
  }

  close(): void {
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }

  getName(): string {
    return this.name;
  }
}

interface QueuedPacket {
  data: Buffer;
  deliverAt: number;
  destination: 'sender' | 'receiver';
}

/** Sender→receiver DATA chunk (not HELLO / control). */
function isDataChunkToReceiver(data: Buffer): boolean {
  if (data.length < CHUNK_HEADER_SIZE) {
    return false;
  }
  if (data.length === 20 && data.readUInt8(0) === MessageType.HELLO) {
    return false;
  }
  return true;
}

export class MockChannel {
  private queue: QueuedPacket[] = [];
  private disconnectTimer: NodeJS.Timeout | null = null;
  private startTime: number;
  private rng: IRNG;
  private clock: IClock;
  private deliveredDataPacketsToReceiver = 0;
  private disconnectAfterDeliveredPackets: number | undefined;
  private isDisconnected = false;

  constructor(
    private config: MockChannelConfig,
    private senderTransport: MockTransport,
    private receiverTransport: MockTransport,
    rng: IRNG = new SystemRNG(),
    clock: IClock = new SystemClock()
  ) {
    this.startTime = clock.now();
    this.rng = rng;
    this.clock = clock;

    if (config.disconnectAfter !== undefined && config.disconnectAfter > 0) {
      this.disconnectTimer = this.clock.setTimeout(() => {
        this.triggerDisconnect();
      }, config.disconnectAfter);
    }
  }

  setPacketLoss(rate: number): void {
    this.config.packetLoss = rate;
  }

  sendFromSender(data: Buffer): void {
    this.processPacket(data, 'receiver');
    this.deliverPackets();
  }

  sendFromReceiver(data: Buffer): void {
    this.processPacket(data, 'sender');
    this.deliverPackets();
  }

  private processPacket(data: Buffer, destination: 'sender' | 'receiver'): void {
    if (this.rng.random() < this.config.packetLoss) {
      return;
    }

    const latency =
      this.config.minLatency +
      this.rng.random() * (this.config.maxLatency - this.config.minLatency);
    const deliverAt = this.clock.now() + latency;

    this.queue.push({ data, deliverAt, destination });

    if (this.rng.random() < this.config.duplicateRate) {
      const dupLatency =
        this.config.minLatency +
        this.rng.random() * (this.config.maxLatency - this.config.minLatency);
      this.queue.push({
        data: Buffer.from(data),
        deliverAt: this.clock.now() + dupLatency,
        destination,
      });
    }

    if (this.rng.random() < this.config.reorderRate && this.queue.length > 1) {
      const sameDestPackets = this.queue
        .map((p, i) => ({ packet: p, index: i }))
        .filter(({ packet }) => packet.destination === destination);

      if (sameDestPackets.length > 1) {
        const idx1 = this.queue.length - 1;
        const randomIdx = Math.floor(this.rng.random() * sameDestPackets.length);
        const idx2 = sameDestPackets[randomIdx].index;
        if (idx1 !== idx2) {
          [this.queue[idx1], this.queue[idx2]] = [this.queue[idx2], this.queue[idx1]];
        }
      }
    }
  }

  deliverPackets(): void {
    const now = this.clock.now();
    const toDeliver: QueuedPacket[] = [];
    const remaining: QueuedPacket[] = [];

    for (const packet of this.queue) {
      if (packet.deliverAt <= now) {
        toDeliver.push(packet);
      } else {
        remaining.push(packet);
      }
    }

    this.queue = remaining;

    for (const packet of toDeliver) {
      if (this.isDisconnected) {
        break;
      }

      if (packet.destination === 'receiver' && !this.receiverTransport.isClosed()) {
        const isData = isDataChunkToReceiver(packet.data);
        this.receiverTransport.receiveData(packet.data);
        if (isData) {
          this.deliveredDataPacketsToReceiver++;
          if (
            this.disconnectAfterDeliveredPackets !== undefined &&
            this.deliveredDataPacketsToReceiver >= this.disconnectAfterDeliveredPackets
          ) {
            this.triggerDisconnect();
            break;
          }
        }
      } else if (packet.destination === 'sender' && !this.senderTransport.isClosed()) {
        this.senderTransport.receiveData(packet.data);
      }
    }
  }

  setDisconnectAfterDeliveredPackets(count: number): void {
    this.disconnectAfterDeliveredPackets = count;
    this.deliveredDataPacketsToReceiver = 0;
  }

  private triggerDisconnect(): void {
    if (this.isDisconnected) {
      return;
    }
    this.isDisconnected = true;
    this.senderTransport.triggerDisconnect();
    this.receiverTransport.triggerDisconnect();
  }

  reconnect(): void {
    this.isDisconnected = false;
    this.senderTransport.reconnect();
    this.receiverTransport.reconnect();
  }

  close(): void {
    if (this.disconnectTimer) {
      this.clock.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    this.queue = [];
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

export function createMockTransportPair(
  channelConfig: MockChannelConfig,
  rng: IRNG = new SystemRNG(),
  clock: IClock = new SystemClock()
): {
  senderTransport: MockTransport;
  receiverTransport: MockTransport;
  channel: MockChannel;
  clock: IClock;
} {
  let channelRef: MockChannel | null = null;

  const senderTransport = new MockTransport('sender', (data: Buffer) => {
    if (channelRef) {
      channelRef.sendFromSender(data);
    }
  });

  const receiverTransport = new MockTransport('receiver', (data: Buffer) => {
    if (channelRef) {
      channelRef.sendFromReceiver(data);
    }
  });

  channelRef = new MockChannel(channelConfig, senderTransport, receiverTransport, rng, clock);

  return {
    senderTransport,
    receiverTransport,
    channel: channelRef,
    clock,
  };
}
