import { EventEmitter } from 'events';

import {
  Chunk,
  assembleChunks,
  calculateCRC32,
  deserializeChunk,
  extractDigestFromLastChunk,
  verifyDigest
} from './chunk';
import { IClock, ITransport, SystemClock } from './sender';
import {
  AckLevel,
  DEFAULT_CONFIG,
  ErrorCode,
  HelloMessage,
  MessageType,
  PROTOCOL_VERSION,
  TransferConfig,
  TransferEvent,
  TransferState
} from './types';

export class Receiver extends EventEmitter {
  private state: TransferState = TransferState.IDLE;
  private config: TransferConfig;
  private chunks: Map<number, Chunk> = new Map();
  private expectedTotal = 0;
  private receivedDigest: Buffer | null = null;
  private negotiatedMTU = 0;
  private clock: IClock;

  constructor(
    private transport: ITransport,
    config: Partial<TransferConfig> = {},
    clock: IClock = new SystemClock()
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.clock = clock;

    this.transport.on('data', this.handleData.bind(this));
    this.transport.on('disconnect', this.handleDisconnect.bind(this));
  }

  public getReceivedChunkSeqs(): number[] {
    return Array.from(this.chunks.keys()).sort((a, b) => a - b);
  }

  public sendResumeRequest(msgId: string): void {
    // RESUME_REQUEST: 1 byte type + 32 bytes msgId hash + variable bitmap
    const receivedSeqs = this.getReceivedChunkSeqs();
    const buffer = Buffer.alloc(1 + 32 + receivedSeqs.length * 2);
    buffer.writeUInt8(MessageType.RESUME_REQUEST, 0);
    // msgId hash (simplified - use first 32 chars)
    Buffer.from(msgId.padEnd(32, '0')).copy(buffer, 1, 0, 32);
    // Write received seq numbers
    receivedSeqs.forEach((seq, idx) => {
      buffer.writeUInt16BE(seq, 33 + idx * 2);
    });
    this.transport.send(buffer);
  }

  private handleData(data: Buffer): void {
    if (data.length === 0) return;

    const msgType = data.readUInt8(0);

    if (msgType === MessageType.HELLO && this.state === TransferState.IDLE) {
      this.handleHello(data);
    } else if (data.length >= 12) {
      // Chunk data
      this.handleChunk(data);
    }
  }

  private async handleHello(data: Buffer): Promise<void> {
    if (data.length < 20) { // type(1) + version(1) + nonce(16) + mtu(2)
      await this.sendHelloAck(0, 0, Buffer.alloc(16), ErrorCode.GENERIC_TIMEOUT);
      return;
    }

    const hello: HelloMessage = {
      type: MessageType.HELLO,
      version: data.readUInt8(1),
      nonce: data.slice(2, 18),
      mtu: data.readUInt16BE(18)
    };

    this.logEvent({ timestamp: this.clock.now(), event: 'hello_received', msgId: '00000000' });

    if (hello.version !== PROTOCOL_VERSION) {
      this.logEvent({ 
        timestamp: this.clock.now(), 
        event: 'version_mismatch', 
        msgId: '00000000',
        error: `Expected ${PROTOCOL_VERSION}, got ${hello.version}` 
      });
      await this.sendHelloAck(hello.version, 0, hello.nonce, ErrorCode.VERSION_MISMATCH);
      return;
    }

    // Negotiate MTU
    this.negotiatedMTU = Math.min(this.config.mtu, hello.mtu);
    
    await this.sendHelloAck(PROTOCOL_VERSION, this.negotiatedMTU, hello.nonce, 0);
    this.state = TransferState.READY;
    this.logEvent({ timestamp: this.clock.now(), event: 'ready', msgId: '00000000' });
  }

  private async sendHelloAck(
    version: number, 
    mtu: number, 
    nonceEcho: Buffer, 
    status: number
  ): Promise<void> {
    const buffer = Buffer.alloc(21);
    buffer.writeUInt8(MessageType.HELLO_ACK, 0);
    buffer.writeUInt8(version, 1);
    nonceEcho.copy(buffer, 2);
    buffer.writeUInt16BE(mtu, 18);
    buffer.writeUInt8(status, 20);
    await this.transport.send(buffer);
  }

  private async handleChunk(data: Buffer): Promise<void> {
    if (this.state !== TransferState.READY && this.state !== TransferState.VERIFYING) {
      return;
    }

    try {
      const chunk = deserializeChunk(data);
      
      // Early return if deserialization failed
      if (!chunk) {
        this.logEvent({ 
          timestamp: this.clock.now(), 
          event: 'chunk_error', 
          msgId: '00000000',
          seq: 0,
          error: 'Deserialization failed' 
        });
        return;
      }

      // Verify CRC
      const crc = calculateCRC32(chunk.payload);
      if (chunk.header.crc32 !== crc) {
        await this.sendNack(chunk.header.seq, ErrorCode.CRC_MISMATCH);
        this.logEvent({ 
          timestamp: this.clock.now(), 
          event: 'crc_mismatch', 
          msgId: this.getMsgIdHash(chunk),
          seq: chunk.header.seq 
        });
        return;
      }

      // First chunk sets expected total
      if (this.expectedTotal === 0) {
        this.expectedTotal = chunk.header.total;
        this.logEvent({ 
          timestamp: this.clock.now(), 
          event: 'transfer_start', 
          msgId: this.getMsgIdHash(chunk),
          total: this.expectedTotal 
        });
      } else if (chunk.header.total !== this.expectedTotal) {
        // Total mismatch
        await this.sendNack(chunk.header.seq, ErrorCode.TOTAL_MISMATCH);
        this.fail(ErrorCode.TOTAL_MISMATCH, 
          `Total mismatch: expected ${this.expectedTotal}, got ${chunk.header.total}`);
        return;
      }

      // Check for duplicate
      if (this.chunks.has(chunk.header.seq)) {
        this.logEvent({ 
          timestamp: this.clock.now(), 
          event: 'duplicate_chunk', 
          msgId: this.getMsgIdHash(chunk),
          seq: chunk.header.seq 
        });
        // Send ACK anyway (idempotent)
        await this.sendAck(chunk.header.seq);
        return;
      }

      // Store chunk
      this.chunks.set(chunk.header.seq, chunk);
      this.logEvent({ 
        timestamp: this.clock.now(), 
        event: 'chunk_received', 
        msgId: this.getMsgIdHash(chunk),
        seq: chunk.header.seq,
        total: this.expectedTotal 
      });

      // Send ACK
      await this.sendAck(chunk.header.seq);

      // Check if complete
      if (this.chunks.size === this.expectedTotal) {
        await this.verifyAndComplete();
      }

    } catch (error: unknown) {
      // CRC mismatch or other error
      const seq = data.length >= 2 ? data.readUInt16BE(0) : 0;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logEvent({ 
        timestamp: this.clock.now(), 
        event: 'chunk_error', 
        msgId: '00000000',
        seq,
        error: errorMessage
      });
      await this.sendNack(seq, ErrorCode.CRC_MISMATCH);
    }
  }

  private async verifyAndComplete(): Promise<void> {
    this.state = TransferState.VERIFYING;
    this.logEvent({ 
      timestamp: this.clock.now(), 
      event: 'verifying', 
      msgId: this.getMsgIdHashFromChunks() 
    });

    try {
      // Get chunks in order
      const orderedChunks: Chunk[] = [];
      for (let i = 0; i < this.expectedTotal; i++) {
        const chunk = this.chunks.get(i);
        if (!chunk) {
          throw new Error(`Missing chunk ${i}`);
        }
        orderedChunks.push(chunk);
      }

      // Extract digest from last chunk
      const lastChunk = orderedChunks[orderedChunks.length - 1];
      const extracted = extractDigestFromLastChunk(lastChunk);
      
      if (!extracted) {
        throw new Error('Failed to extract digest from last chunk');
      }
      
      const { digest, data: lastData } = extracted;
      this.receivedDigest = digest;

      // Assemble message (replace last chunk payload with extracted data)
      const modifiedChunks = [...orderedChunks];
      modifiedChunks[modifiedChunks.length - 1] = {
        ...lastChunk,
        payload: lastData
      };

      const assembled = assembleChunks(modifiedChunks);

      // Verify digest
      if (!verifyDigest(assembled, digest)) {
        this.fail(ErrorCode.DIGEST_INVALID, 'Digest verification failed');
        return;
      }

      // Success!
      this.state = TransferState.COMPLETED;
      this.logEvent({ 
        timestamp: this.clock.now(), 
        event: 'transfer_complete', 
        msgId: this.getMsgIdHashFromChunks() 
      });

      // CRITICAL: Only emit PEER_RECEIVED after ALL validations pass
      this.emit('completed', { 
        payload: assembled, 
        ackLevel: AckLevel.PEER_RECEIVED 
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.fail(ErrorCode.DIGEST_INVALID, `Verification failed: ${errorMessage}`);
    }
  }

  private async sendAck(seq: number): Promise<void> {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt8(MessageType.ACK, 0);
    buffer.writeUInt16BE(seq, 1);
    buffer.writeUInt8(0, 3); // status OK
    await this.transport.send(buffer);
  }

  private async sendNack(seq: number, reason: ErrorCode): Promise<void> {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt8(MessageType.NACK, 0);
    buffer.writeUInt16BE(seq, 1);
    buffer.writeUInt8(reason, 3);
    await this.transport.send(buffer);
  }

  private fail(code: ErrorCode, message: string): void {
    this.state = TransferState.FAILED;
    this.logEvent({ 
      timestamp: this.clock.now(), 
      event: 'transfer_failed', 
      msgId: this.getMsgIdHashFromChunks(),
      error: `Code ${code}: ${message}` 
    });
    // CRITICAL: NEVER emit PEER_RECEIVED on failure
    this.emit('failed', { code, message });
  }

  private handleDisconnect(): void {
    if (this.state === TransferState.COMPLETED || this.state === TransferState.FAILED) {
      return;
    }
    this.fail(ErrorCode.GENERIC_TIMEOUT, 'Transport disconnected');
  }

  private getMsgIdHash(chunk: Chunk): string {
    // Use seq as temporary identifier
    return chunk.header.seq.toString(16).padStart(8, '0');
  }

  private getMsgIdHashFromChunks(): string {
    if (!this.receivedDigest) return '00000000';
    return this.receivedDigest.slice(0, 4).toString('hex');
  }

  private logEvent(event: TransferEvent): void {
    // JSONL format, no payload/GPS/PII
    this.emit('event', event);
  }

  getState(): TransferState {
    return this.state;
  }

  getMissingChunks(): number[] {
    if (this.expectedTotal === 0) return [];
    const missing: number[] = [];
    for (let i = 0; i < this.expectedTotal; i++) {
      if (!this.chunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  close(): void {
    this.transport.close();
  }
}
