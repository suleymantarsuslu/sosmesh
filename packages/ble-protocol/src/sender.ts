import { EventEmitter } from 'events';

import {
  Chunk,
  calculateDigest,
  createLastChunkWithDigest,
  serializeChunk,
  splitIntoChunks
} from './chunk';
import {
  DEFAULT_CONFIG,
  ErrorCode,
  HelloMessage,
  MessageType,
  PROTOCOL_VERSION,
  TransferConfig,
  TransferEvent,
  TransferState
} from './types';

export interface ITransport {
  send(data: Buffer): Promise<void>;
  on(event: 'data', handler: (data: Buffer) => void): void;
  on(event: 'disconnect', handler: () => void): void;
  close(): void;
}

export interface IClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): NodeJS.Timeout;
  clearTimeout(timer: NodeJS.Timeout): void;
}

export interface IRNG {
  random(): number; // [0, 1)
}

export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
  setTimeout(fn: () => void, ms: number): NodeJS.Timeout {
    return setTimeout(fn, ms);
  }
  clearTimeout(timer: NodeJS.Timeout): void {
    clearTimeout(timer);
  }
}

export class SimulatedClock implements IClock {
  private currentTime = 0;
  private timers: Array<{ id: number; fireAt: number; fn: () => void }> = [];
  private nextId = 1;

  now(): number {
    return this.currentTime;
  }

  setTimeout(fn: () => void, ms: number): NodeJS.Timeout {
    const id = this.nextId++;
    this.timers.push({ id, fireAt: this.currentTime + ms, fn });
    this.timers.sort((a, b) => a.fireAt - b.fireAt);
    return id as unknown as NodeJS.Timeout;
  }

  clearTimeout(id: NodeJS.Timeout): void {
    const numericId = id as unknown as number;
    this.timers = this.timers.filter(t => t.id !== numericId);
  }

  async advanceAsync(ms: number): Promise<void> {
    const targetTime = this.currentTime + ms;
    
    while (this.timers.length > 0 && this.timers[0].fireAt <= targetTime) {
      const timer = this.timers.shift()!;
      this.currentTime = timer.fireAt;
      timer.fn();
      await Promise.resolve(); // Flush microtask queue
      this.timers.sort((a, b) => a.fireAt - b.fireAt);
    }
    
    this.currentTime = targetTime;
    await Promise.resolve(); // Final flush
  }

  advance(ms: number): void {
    const targetTime = this.currentTime + ms;
    
    while (this.timers.length > 0 && this.timers[0].fireAt <= targetTime) {
      const timer = this.timers.shift()!;
      this.currentTime = timer.fireAt;
      timer.fn();
      this.timers.sort((a, b) => a.fireAt - b.fireAt);
    }
    
    this.currentTime = targetTime;
  }

  tick(): void {
    this.advance(10);
  }

  hasPendingTimers(): boolean {
    return this.timers.length > 0;
  }
}

export class SystemRNG implements IRNG {
  random(): number {
    return Math.random();
  }
}

export class Sender extends EventEmitter {
  private state: TransferState = TransferState.IDLE;
  private config: TransferConfig;
  private chunks: Chunk[] = [];
  private currentSeq = 0;
  private inFlightChunks = new Set<number>();
  private retryCount = new Map<number, number>();
  private ackReceived = new Set<number>();
  private nonce: Buffer | null = null;
  private negotiatedMTU = 0;
  private chunkTimeout: NodeJS.Timeout | null = null;
  private originalPayload: Buffer | null = null;
  private expectedDigest: Buffer | null = null;
  private clock: IClock;
  private rng: IRNG;

  constructor(
    private transport: ITransport,
    config: Partial<TransferConfig> = {},
    clock: IClock = new SystemClock(),
    rng: IRNG = new SystemRNG()
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.clock = clock;
    this.rng = rng;

    this.transport.on('data', this.handleData.bind(this));
    this.transport.on('disconnect', this.handleDisconnect.bind(this));
  }

  async startTransfer(payload: Buffer, msgId: string): Promise<void> {
    if (this.state !== TransferState.IDLE) {
      throw new Error(`Cannot start transfer in state ${this.state}`);
    }

    this.originalPayload = payload;
    this.expectedDigest = calculateDigest(payload);
    this.logEvent({ timestamp: this.clock.now(), event: 'transfer_start', msgId, total: 0 });

    // Send HELLO
    this.nonce = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      this.nonce[i] = Math.floor(this.rng.random() * 256);
    }

    const hello: HelloMessage = {
      type: MessageType.HELLO,
      version: PROTOCOL_VERSION,
      nonce: this.nonce,
      mtu: this.config.mtu
    };

    this.state = TransferState.HELLO_SENT;
    await this.sendHello(hello);
    this.logEvent({ timestamp: this.clock.now(), event: 'hello_sent', msgId });

    // Set timeout for HELLO_ACK
    this.chunkTimeout = this.clock.setTimeout(() => {
      if (this.state === TransferState.HELLO_SENT) {
        this.fail(ErrorCode.TIMEOUT, 'HELLO_ACK timeout');
      }
    }, 5000);
  }

  private async sendHello(hello: HelloMessage): Promise<void> {
    const buffer = Buffer.alloc(20); // type(1) + version(1) + nonce(16) + mtu(2)
    buffer.writeUInt8(hello.type, 0);
    buffer.writeUInt8(hello.version, 1);
    hello.nonce.copy(buffer, 2);
    buffer.writeUInt16BE(hello.mtu, 18);
    await this.transport.send(buffer);
  }

  private handleData(data: Buffer): void {
    if (data.length === 0) return;

    const msgType = data.readUInt8(0);

    if (msgType === MessageType.HELLO_ACK && this.state === TransferState.HELLO_SENT) {
      this.handleHelloAck(data);
    } else if (msgType === MessageType.ACK && 
               (this.state === TransferState.WAIT_ACK || 
                this.state === TransferState.SENDING ||
                this.state === TransferState.READY)) {
      this.handleAck(data);
    } else if (msgType === MessageType.NACK && 
               (this.state === TransferState.WAIT_ACK || this.state === TransferState.SENDING)) {
      this.handleNack(data);
    } else if (msgType === MessageType.RESUME_REQUEST && this.chunks.length > 0) {
      this.handleResumeRequest(data);
    }
  }

  private handleHelloAck(data: Buffer): void {
    if (data.length < 21) return;

    const version = data.readUInt8(1);
    const nonceEcho = data.slice(2, 18);
    const mtu = data.readUInt16BE(18);
    const status = data.readUInt8(20);

    if (version !== PROTOCOL_VERSION) {
      this.fail(ErrorCode.VERSION_MISMATCH, `Version mismatch: ${version} != ${PROTOCOL_VERSION}`);
      return;
    }

    if (!this.nonce || !nonceEcho.equals(this.nonce)) {
      this.fail(ErrorCode.GENERIC_TIMEOUT, 'Nonce mismatch');
      return;
    }

    if (status !== 0) {
      this.fail(status, 'HELLO_ACK rejected');
      return;
    }

    if (this.chunkTimeout) {
      this.clock.clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }

    // Negotiate MTU
    this.negotiatedMTU = Math.min(this.config.mtu, mtu);
    const chunkSize = this.negotiatedMTU - 3 - 12; // ATT overhead - header

    // Split payload into chunks
    const normalChunks = splitIntoChunks(this.originalPayload!, chunkSize);
    
    // Replace last chunk with digest-enhanced version
    const lastSeq = normalChunks.length - 1;
    this.chunks = normalChunks.slice(0, -1);
    this.chunks.push(
      createLastChunkWithDigest(this.originalPayload!, chunkSize, lastSeq, normalChunks.length)
    );

    this.state = TransferState.READY;
    this.currentSeq = 0;
    this.sendNextChunks();
  }

  private async sendNextChunks(): Promise<void> {
    if (this.state !== TransferState.READY && this.state !== TransferState.SENDING) {
      return;
    }

    this.state = TransferState.SENDING;

    while (
      this.inFlightChunks.size < this.config.windowSize &&
      this.currentSeq < this.chunks.length
    ) {
      const seq = this.currentSeq;
      if (!this.ackReceived.has(seq) && !this.inFlightChunks.has(seq)) {
        await this.sendChunk(seq);
      }
      this.currentSeq++;
    }

    if (this.inFlightChunks.size > 0) {
      this.state = TransferState.WAIT_ACK;
      this.setChunkTimeout();
    } else if (this.ackReceived.size === this.chunks.length) {
      this.complete();
    } else if (this.state === TransferState.SENDING) {
      this.state = TransferState.WAIT_ACK;
      this.setChunkTimeout();
    }
  }

  private async sendChunk(seq: number): Promise<void> {
    const chunk = this.chunks[seq];
    const serialized = serializeChunk(chunk);
    
    this.inFlightChunks.add(seq);
    await this.transport.send(serialized);
    
    this.logEvent({ 
      timestamp: this.clock.now(), 
      event: 'chunk_sent', 
      msgId: this.getMsgIdHash(),
      seq, 
      total: this.chunks.length 
    });
  }

  private setChunkTimeout(): void {
    if (this.chunkTimeout) {
      this.clock.clearTimeout(this.chunkTimeout);
    }

    const jitter = Math.floor(this.rng.random() * this.config.retryJitter);
    this.chunkTimeout = this.clock.setTimeout(() => {
      this.handleChunkTimeout();
    }, this.config.chunkTimeout + jitter);
  }

  private handleChunkTimeout(): void {
    if (this.inFlightChunks.size === 0) {
      if (this.state !== TransferState.WAIT_ACK) {
        return;
      }
      if (this.ackReceived.size === this.chunks.length) {
        this.complete();
        return;
      }
      this.state = TransferState.READY;
      this.currentSeq = 0;
      this.sendNextChunks();
      return;
    }
    if (this.state !== TransferState.WAIT_ACK && this.state !== TransferState.SENDING) {
      return;
    }

    // Retry all in-flight chunks
    const chunksToRetry = Array.from(this.inFlightChunks);
    for (const seq of chunksToRetry) {
      const retries = this.retryCount.get(seq) || 0;
      if (retries >= this.config.maxRetries) {
        this.fail(ErrorCode.TIMEOUT, `Max retries exceeded for chunk ${seq}`);
        return;
      }
      this.retryCount.set(seq, retries + 1);
    }

    this.inFlightChunks.clear();
    this.state = TransferState.READY;
    this.sendNextChunks();
  }

  private handleAck(data: Buffer): void {
    if (data.length < 4) return;

    const seq = data.readUInt16BE(1);
    const status = data.readUInt8(3);

    if (status !== 0) {
      this.logEvent({ 
        timestamp: this.clock.now(), 
        event: 'ack_error', 
        msgId: this.getMsgIdHash(),
        seq, 
        error: `Status ${status}` 
      });
      return;
    }

    this.ackReceived.add(seq);
    this.inFlightChunks.delete(seq);
    this.logEvent({ 
      timestamp: this.clock.now(), 
      event: 'ack_received', 
      msgId: this.getMsgIdHash(),
      seq 
    });

    if (this.chunkTimeout) {
      this.clock.clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }

    // Continue sending
    if (this.ackReceived.size === this.chunks.length) {
      this.complete();
    } else {
      this.state = TransferState.READY;
      this.sendNextChunks();
    }
  }

  private handleNack(data: Buffer): void {
    if (data.length < 4) return;

    const seq = data.readUInt16BE(1);
    const reason = data.readUInt8(3);

    this.logEvent({ 
      timestamp: this.clock.now(), 
      event: 'nack_received', 
      msgId: this.getMsgIdHash(),
      seq, 
      error: `Reason ${reason}` 
    });

    this.inFlightChunks.delete(seq);
    const retries = this.retryCount.get(seq) || 0;
    
    if (retries >= this.config.maxRetries) {
      this.fail(reason, `Max retries exceeded for chunk ${seq} after NACK`);
      return;
    }

    this.retryCount.set(seq, retries + 1);

    if (this.chunkTimeout) {
      this.clock.clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }

    this.state = TransferState.READY;
    this.sendNextChunks();
  }

  private handleResumeRequest(data: Buffer): void {
    if (data.length < 19) return;

    const receivedCount = data.readUInt16BE(1);
    const transferId = data.slice(3, 19);
    const minLength = 19 + receivedCount * 2;
    if (data.length < minLength) return;

    if (!this.nonce || !transferId.equals(this.nonce)) {
      this.logEvent({
        timestamp: this.clock.now(),
        event: 'resume_rejected',
        msgId: this.getMsgIdHash(),
        error: 'Transfer ID mismatch',
      });
      return;
    }

    const receivedSeqs = new Set<number>();
    for (let i = 0; i < receivedCount; i++) {
      const seq = data.readUInt16BE(19 + i * 2);
      receivedSeqs.add(seq);
    }

    this.ackReceived = receivedSeqs;
    this.inFlightChunks.clear();
    this.currentSeq = 0;
    this.retryCount.clear();

    if (this.chunkTimeout) {
      this.clock.clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }

    this.logEvent({
      timestamp: this.clock.now(),
      event: 'resume_accepted',
      msgId: this.getMsgIdHash(),
      total: this.chunks.length,
    });

    this.state = TransferState.READY;
    this.sendNextChunks();
  }

  private complete(): void {
    this.state = TransferState.COMPLETED;
    this.logEvent({ 
      timestamp: this.clock.now(), 
      event: 'transfer_complete', 
      msgId: this.getMsgIdHash(),
      total: this.chunks.length 
    });
    this.emit('completed');
  }

  private fail(code: ErrorCode, message: string): void {
    this.state = TransferState.FAILED;
    if (this.chunkTimeout) {
      this.clock.clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }
    this.logEvent({ 
      timestamp: this.clock.now(), 
      event: 'transfer_failed', 
      msgId: this.getMsgIdHash(),
      error: `Code ${code}: ${message}` 
    });
    this.emit('failed', { code, message });
  }

  private handleDisconnect(): void {
    if (this.state === TransferState.COMPLETED || this.state === TransferState.FAILED) {
      return;
    }
    
    if (this.chunks.length > 0) {
      this.state = TransferState.RESUMING;
      if (this.chunkTimeout) {
        this.clock.clearTimeout(this.chunkTimeout);
        this.chunkTimeout = null;
      }
      this.logEvent({ 
        timestamp: this.clock.now(), 
        event: 'disconnect_resumable', 
        msgId: this.getMsgIdHash(),
        total: this.chunks.length 
      });
    } else {
      this.fail(ErrorCode.GENERIC_TIMEOUT, 'Transport disconnected');
    }
  }

  private getMsgIdHash(): string {
    if (!this.expectedDigest) return '00000000';
    return this.expectedDigest.slice(0, 4).toString('hex');
  }

  private logEvent(event: TransferEvent): void {
    // JSONL format, no payload/GPS/PII
    this.emit('event', event);
  }

  getState(): TransferState {
    return this.state;
  }

  close(): void {
    if (this.chunkTimeout) {
      this.clock.clearTimeout(this.chunkTimeout);
    }
    this.transport.close();
  }
}
