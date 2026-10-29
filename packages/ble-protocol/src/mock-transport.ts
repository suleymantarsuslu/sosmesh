import { EventEmitter } from 'events';
import { ITransport, IRNG, SystemRNG } from './sender';

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
    }
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

export class MockChannel {
  private queue: QueuedPacket[] = [];
  private disconnectTimer: NodeJS.Timeout | null = null;
  private processingTimer: NodeJS.Timeout | null = null;
  private startTime: number;
  private rng: IRNG;

  constructor(
    private config: MockChannelConfig,
    private senderTransport: MockTransport,
    private receiverTransport: MockTransport,
    rng: IRNG = new SystemRNG()
  ) {
    this.startTime = Date.now();
    this.rng = rng;

    if (config.disconnectAfter !== undefined && config.disconnectAfter > 0) {
      this.disconnectTimer = setTimeout(() => {
        this.triggerDisconnect();
      }, config.disconnectAfter);
    }

    this.startProcessing();
  }

  sendFromSender(data: Buffer): void {
    this.processPacket(data, 'receiver');
  }

  sendFromReceiver(data: Buffer): void {
    this.processPacket(data, 'sender');
  }

  private processPacket(data: Buffer, destination: 'sender' | 'receiver'): void {
    // Packet loss
    if (this.rng.random() < this.config.packetLoss) {
      return; // Drop packet
    }

    const latency = this.config.minLatency + 
                    this.rng.random() * (this.config.maxLatency - this.config.minLatency);
    const deliverAt = Date.now() + latency;

    // Queue packet
    this.queue.push({ data, deliverAt, destination });

    // Duplicate
    if (this.rng.random() < this.config.duplicateRate) {
      const dupLatency = this.config.minLatency + 
                         this.rng.random() * (this.config.maxLatency - this.config.minLatency);
      this.queue.push({ 
        data: Buffer.from(data), 
        deliverAt: Date.now() + dupLatency,
        destination
      });
    }

    // Reorder: swap with a random packet in queue going to same destination
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

  private startProcessing(): void {
    this.processingTimer = setInterval(() => {
      this.deliverPackets();
    }, 10); // Check every 10ms
  }

  private deliverPackets(): void {
    const now = Date.now();
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
      if (packet.destination === 'receiver' && !this.receiverTransport.isClosed()) {
        this.receiverTransport.receiveData(packet.data);
      } else if (packet.destination === 'sender' && !this.senderTransport.isClosed()) {
        this.senderTransport.receiveData(packet.data);
      }
    }
  }

  private triggerDisconnect(): void {
    this.senderTransport.triggerDisconnect();
    this.receiverTransport.triggerDisconnect();
  }

  close(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    this.queue = [];
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

export function createMockTransportPair(
  channelConfig: MockChannelConfig,
  rng: IRNG = new SystemRNG()
): { 
  senderTransport: MockTransport; 
  receiverTransport: MockTransport; 
  channel: MockChannel 
} {
  let channel: MockChannel;

  const senderTransport = new MockTransport('sender', (data: Buffer) => {
    channel.sendFromSender(data);
  });

  const receiverTransport = new MockTransport('receiver', (data: Buffer) => {
    channel.sendFromReceiver(data);
  });

  channel = new MockChannel(channelConfig, senderTransport, receiverTransport, rng);

  return { senderTransport, receiverTransport, channel };
}
