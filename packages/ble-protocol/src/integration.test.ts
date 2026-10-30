import { describe, it, expect } from 'vitest';

import { 
  serializeChunk, 
  splitIntoChunks, 
  calculateCRC32 
} from './chunk';
import { createMockTransportPair, MockChannel, MockTransport } from './mock-transport';
import { Receiver } from './receiver';
import { Sender, SimulatedClock, IClock, IRNG } from './sender';

// Seeded PRNG for deterministic tests
class SeededRNG implements IRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  random(): number {
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    this.seed = (a * this.seed + c) % m;
    return this.seed / m;
  }
}

async function runSimulatedTransfer(
  senderTransport: MockTransport,
  receiverTransport: MockTransport,
  channel: MockChannel,
  clock: IClock,
  payload: Buffer,
  msgId: string,
  maxSimTime: number = 200000,
  maxRetries: number = 20
): Promise<{ success: boolean; receivedPayload: Buffer | null; error?: string }> {
  const sender = new Sender(senderTransport, { maxRetries, chunkTimeout: 1000 }, clock, new SeededRNG(1000));
  const receiver = new Receiver(receiverTransport, {}, clock);

  let receivedPayload: Buffer | null = null;
  let completed = false;
  let failed = false;
  let errorMsg = '';

  sender.on('completed', () => {
    completed = true;
  });

  sender.on('failed', ({ message }: { message: string }) => {
    failed = true;
    errorMsg = message;
  });

  receiver.on('completed', ({ payload }: { payload: Buffer }) => {
    receivedPayload = payload;
  });

  await sender.startTransfer(payload, msgId);

  // Simulate time advancement
  const simClock = clock as SimulatedClock;
  const startTime = simClock.now();
  while (simClock.now() - startTime < maxSimTime && !completed && !failed) {
    await simClock.advanceAsync(10);
    channel.deliverPackets();
    
    if (channel.getQueueSize() === 0 && !simClock.hasPendingTimers()) {
      await simClock.advanceAsync(100);
      if (completed || failed) break;
      await Promise.resolve();
      if (!simClock.hasPendingTimers() && channel.getQueueSize() === 0) {
        break;
      }
    }
  }

  return { 
    success: completed, 
    receivedPayload,
    error: failed ? errorMsg : undefined 
  };
}

describe('BLE Protocol Integration Tests (Simulated Clock)', () => {
  it('should successfully transfer a message end-to-end', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(42);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    }, rng, clock);

    const testPayload = Buffer.from(JSON.stringify({
      envelope: {
        timestamp: '2026-10-29T18:00:00Z',
        location: { latitude: 0, longitude: 0 },
        priority: 1,
        ackLevel: 'PEER_RECEIVED'
      },
      encryptedPayload: 'BASE64_ENCRYPTED_CONTENT_NO_REAL_PII'
    }));

    const result = await runSimulatedTransfer(
      senderTransport, 
      receiverTransport, 
      channel, 
      clock, 
      testPayload, 
      'integration_test'
    );

    expect(result.success).toBe(true);
    expect(result.receivedPayload).not.toBeNull();
    expect(result.receivedPayload!.equals(testPayload)).toBe(true);
  });

  it('should handle packet loss with retries (%10 loss, deterministic)', async () => {
    // Deterministic scenario: 10% loss should complete with retries
    const clock = new SimulatedClock();
    const rng = new SeededRNG(1000);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.10,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 5,
      maxLatency: 15
    }, rng, clock);

    const testPayload = Buffer.from('TEST_10PCT_LOSS_' + 'X'.repeat(400));

    const result = await runSimulatedTransfer(
      senderTransport, 
      receiverTransport, 
      channel, 
      clock, 
      testPayload, 
      'loss_10pct',
      250000,
      25
    );

    // With 10% loss and 25 retries, should complete + byte equality
    expect(result.success).toBe(true);
    expect(result.receivedPayload).not.toBeNull();
    expect(result.receivedPayload!.equals(testPayload)).toBe(true);
  });

  it('should handle moderate packet loss (15%) with resume', async () => {
    // Resume capability test - Moderate loss with retries demonstrates
    // "kesilen transfer yanlış teslim üretmeden yeniden denenebiliyor"
    const clock = new SimulatedClock();
    const rng = new SeededRNG(3000);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.15,
      duplicateRate: 0.02,
      reorderRate: 0.03,
      minLatency: 5,
      maxLatency: 15
    }, rng, clock);

    const testPayload = Buffer.from('TEST_15PCT_LOSS_' + 'Z'.repeat(250));

    const result = await runSimulatedTransfer(
      senderTransport, 
      receiverTransport, 
      channel, 
      clock, 
      testPayload, 
      'loss_15pct',
      250000,
      30
    );

    // With 15% loss and 30 retries, should complete + byte equality
    // Demonstrates: network issues → automatic retry → completion (no wrong delivery)
    expect(result.success).toBe(true);
    expect(result.receivedPayload).not.toBeNull();
    expect(result.receivedPayload!.equals(testPayload)).toBe(true);
  });


  it('MANDATORY: should reject valid CRC but invalid digest (no wrong delivery)', async () => {
    // Hedefli yanlış-teslim testi: CRC geçerli ama envelope digest tutmuyor
    // KANIT: Receiver teslim ETMEMELİ (yanlış teslim yok garantisi)
    const clock = new SimulatedClock();
    const rng = new SeededRNG(9999);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 5,
      maxLatency: 10
    }, rng, clock);

    const receiver = new Receiver(receiverTransport, {}, clock);
    const sender = new Sender(senderTransport, {}, clock, rng);
    
    let deliveredPayload: Buffer | null = null;
    let completedCount = 0;
    let failedCount = 0;

    receiver.on('completed', ({ payload }: { payload: Buffer }) => {
      deliveredPayload = payload;
      completedCount++;
    });

    receiver.on('failed', () => {
      failedCount++;
    });

    const originalPayload = Buffer.from('ORIGINAL_DATA');
    
    // Start transfer normally
    await sender.startTransfer(originalPayload, 'digest_attack');

    // Let HELLO negotiation complete
    await clock.advanceAsync(50);
    channel.deliverPackets();
    await clock.advanceAsync(50);
    channel.deliverPackets();

    // Manually send chunks with corrupted digest
    const chunks = splitIntoChunks(originalPayload, 50);
    
    // Send all chunks except last
    for (let i = 0; i < chunks.length - 1; i++) {
      const serialized = serializeChunk(chunks[i]);
      receiverTransport.emit('data', serialized);
      await clock.advanceAsync(20);
      channel.deliverPackets();
    }

    // Corrupt the last chunk (which contains digest)
    const lastChunk = chunks[chunks.length - 1];
    const corruptedPayload = Buffer.concat([
      lastChunk.payload.slice(0, -32), // keep data
      Buffer.alloc(32, 0xFF) // wrong digest (all 0xFF)
    ]);
    const corruptedChunk = {
      header: {
        ...lastChunk.header,
        crc32: calculateCRC32(corruptedPayload) // Valid CRC but wrong digest
      },
      payload: corruptedPayload
    };

    const corruptedSerialized = serializeChunk(corruptedChunk);
    receiverTransport.emit('data', corruptedSerialized);
    
    await clock.advanceAsync(100);
    channel.deliverPackets();
    await clock.advanceAsync(100);

    // KANIT: Receiver MUST NOT deliver (digest mismatch)
    // "Yanlış teslim yok" garantisi
    expect(deliveredPayload).toBeNull();
    expect(completedCount).toBe(0);
    expect(failedCount).toBeGreaterThan(0);
  });

  it('should handle reordered packets', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(200);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0.8,
      minLatency: 10,
      maxLatency: 100
    }, rng, clock);

    const testPayload = Buffer.from('TEST_REORDERING_' + 'Y'.repeat(600));

    const result = await runSimulatedTransfer(
      senderTransport, 
      receiverTransport, 
      channel, 
      clock, 
      testPayload, 
      'reorder_test',
      120000
    );

    expect(result.success).toBe(true);
    expect(result.receivedPayload).not.toBeNull();
    expect(result.receivedPayload!.equals(testPayload)).toBe(true);
  });

  it('should deduplicate duplicate packets', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(300);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0.5,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 30
    }, rng, clock);

    const receiver = new Receiver(receiverTransport, {}, clock);
    let deliveryCount = 0;

    receiver.on('completed', () => {
      deliveryCount++;
    });

    const sender = new Sender(senderTransport, {}, clock, rng);
    const payload = Buffer.from('DUPLICATE_DETECTION_TEST');

    await sender.startTransfer(payload, 'dup_test');

    const startTime = clock.now();
    while (clock.now() - startTime < 20000) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        await Promise.resolve();
        if (!clock.hasPendingTimers() && channel.getQueueSize() === 0) break;
      }
    }

    expect(deliveryCount).toBe(1);
  });

  it('should log events in secure format (no PII)', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(400);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    }, rng, clock);

    const sensitivePayload = Buffer.from(JSON.stringify({
      envelope: {
        timestamp: '2026-10-29T18:00:00Z',
        location: { latitude: 41.0082, longitude: 28.9784 },
        priority: 1,
        ackLevel: 'PEER_RECEIVED'
      },
      encryptedPayload: 'SECRET_MESSAGE_HELP_NEEDED'
    }));

    const events: Array<{ source: string; [key: string]: unknown }> = [];
    const sender = new Sender(senderTransport, {}, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    sender.on('event', (event) => events.push({ source: 'sender', ...event }));
    receiver.on('event', (event) => events.push({ source: 'receiver', ...event }));

    await sender.startTransfer(sensitivePayload, 'security_test');

    while (clock.hasPendingTimers() || channel.getQueueSize() > 0) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      
      if (clock.now() > 50000) break;
      
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        await Promise.resolve();
        if (!clock.hasPendingTimers() && channel.getQueueSize() === 0) break;
      }
    }

    const allEventStrings = events.map(e => JSON.stringify(e));
    for (const eventStr of allEventStrings) {
      expect(eventStr).not.toContain('41.0082');
      expect(eventStr).not.toContain('28.9784');
      expect(eventStr).not.toContain('SECRET_MESSAGE');
      expect(eventStr).not.toContain('HELP_NEEDED');
      expect(eventStr).not.toContain('encryptedPayload');
    }

    expect(events.some(e => e.event === 'transfer_start')).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('resume after disconnect retransmits only missing chunks', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(5000);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    }, rng, clock);

    const sender = new Sender(senderTransport, { maxRetries: 20 }, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    const testPayload = Buffer.from('RESUME_TEST_' + 'X'.repeat(1000));
    let deliveredPayload: Buffer | null = null;
    let deliveryCount = 0;

    receiver.on('completed', ({ payload }: { payload: Buffer }) => {
      deliveredPayload = payload;
      deliveryCount++;
    });

    const chunksSentBeforeDisconnect = new Set<number>();
    const chunksSentAfterResume = new Set<number>();
    let trackingResumeSends = false;

    sender.on('event', (event: { event: string; seq?: number }) => {
      if (event.event !== 'chunk_sent' || event.seq === undefined) return;
      if (trackingResumeSends) {
        chunksSentAfterResume.add(event.seq);
      } else {
        chunksSentBeforeDisconnect.add(event.seq);
      }
    });

    await sender.startTransfer(testPayload, 'resume_test');

    channel.setDisconnectAfterDeliveredPackets(3);

    while (
      clock.now() < 200000 &&
      sender.getState() !== 'RESUMING' &&
      receiver.getState() !== 'RESUMING'
    ) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      if (sender.getState() === 'COMPLETED' || sender.getState() === 'FAILED') {
        break;
      }
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        await Promise.resolve();
      }
    }

    const totalChunks = sender['chunks'].length;
    expect(totalChunks).toBeGreaterThan(0);

    expect(sender.getState()).toBe('RESUMING');
    expect(receiver.getState()).toBe('RESUMING');

    const receivedBeforeResume = new Set(receiver.getReceivedChunkSeqs());
    const expectedMissing: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      if (!receivedBeforeResume.has(i)) {
        expectedMissing.push(i);
      }
    }
    expect(expectedMissing.length).toBeGreaterThan(0);

    channel.reconnect();
    trackingResumeSends = true;

    await receiver.requestResume();
    await clock.advanceAsync(100);
    channel.deliverPackets();

    while (clock.now() < 200000 && deliveryCount === 0) {
      await clock.advanceAsync(10);
      channel.deliverPackets();

      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        if (deliveryCount > 0) break;
        await Promise.resolve();
        if (!clock.hasPendingTimers() && channel.getQueueSize() === 0) break;
      }
    }

    expect(deliveredPayload).not.toBeNull();
    expect(deliveredPayload!.equals(testPayload)).toBe(true);
    expect(deliveryCount).toBe(1);

    const missingSet = new Set(expectedMissing);
    expect(chunksSentAfterResume.size).toBe(missingSet.size);
    for (const seq of chunksSentAfterResume) {
      expect(missingSet.has(seq)).toBe(true);
    }
    for (const seq of missingSet) {
      expect(chunksSentAfterResume.has(seq)).toBe(true);
    }
    expect(receiver.getState()).toBe('COMPLETED');
  });

  it('no false delivery before resume completes', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(6000);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    }, rng, clock);

    const sender = new Sender(senderTransport, { maxRetries: 20 }, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    const testPayload = Buffer.from('NO_FALSE_DELIVERY_' + 'Y'.repeat(1000));
    let deliveryCount = 0;

    const senderEvents: string[] = [];
    const receiverEvents: string[] = [];

    sender.on('event', (event: any) => {
      senderEvents.push(event.event);
    });

    receiver.on('event', (event: any) => {
      receiverEvents.push(event.event);
    });

    receiver.on('completed', () => {
      deliveryCount++;
    });

    await sender.startTransfer(testPayload, 'no_false_delivery');

    channel.setDisconnectAfterDeliveredPackets(4);

    while (
      clock.now() < 200000 &&
      sender.getState() !== 'RESUMING' &&
      receiver.getState() !== 'RESUMING'
    ) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        await Promise.resolve();
      }
    }

    expect(deliveryCount).toBe(0);
    expect(receiver.getState()).toBe('RESUMING');
    expect(sender.getState()).toBe('RESUMING');

    channel.reconnect();
    
    senderEvents.length = 0;
    receiverEvents.length = 0;
    
    await receiver.requestResume();
    await clock.advanceAsync(50);
    channel.deliverPackets();
    await clock.advanceAsync(50);
    channel.deliverPackets();

    while (clock.now() < 200000 && deliveryCount === 0) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        if (deliveryCount > 0) break;
        await Promise.resolve();
        if (!clock.hasPendingTimers() && channel.getQueueSize() === 0) break;
      }
    }

    expect(senderEvents.includes('resume_accepted')).toBe(true);
    expect(deliveryCount).toBe(1);
  });

  it('>=25% loss: FAILED then resume then COMPLETED', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(7000);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 5,
      maxLatency: 15
    }, rng, clock);

    const sender = new Sender(
      senderTransport,
      { maxRetries: 2, chunkTimeout: 500, windowSize: 1 },
      clock,
      rng
    );
    const receiver = new Receiver(receiverTransport, {}, clock);

    const testPayload = Buffer.from('HIGH_LOSS_RESUME_' + 'Z'.repeat(3000));
    let senderFailed = false;
    let deliveryCount = 0;
    let deliveredPayload: Buffer | null = null;

    sender.on('failed', () => {
      senderFailed = true;
    });

    receiver.on('completed', ({ payload }: { payload: Buffer }) => {
      deliveredPayload = payload;
      deliveryCount++;
    });

    await sender.startTransfer(testPayload, 'high_loss_test');

    while (sender.getState() === 'HELLO_SENT' || sender['chunks'].length === 0) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
    }

    channel.setPacketLoss(0.25);

    while (
      clock.now() < 150000 &&
      receiver.getReceivedChunkSeqs().length < 2 &&
      sender.getState() !== 'COMPLETED' &&
      sender.getState() !== 'FAILED'
    ) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
    }

    expect(receiver.getReceivedChunkSeqs().length).toBeGreaterThan(0);
    expect(sender.getState()).not.toBe('COMPLETED');

    channel.setDropAcksToSender(true);
    channel.setBlockDataToReceiver(true);
    channel.clearQueue();

    const maxTime = clock.now() + 120000;
    while (clock.now() < maxTime && !senderFailed) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
    }

    expect(senderFailed).toBe(true);
    expect(sender.getState()).toBe('FAILED');
    expect(deliveryCount).toBe(0);
    expect(receiver.getState()).not.toBe('COMPLETED');

    channel.setDropAcksToSender(false);
    channel.setBlockDataToReceiver(false);
    channel.reconnect();

    await receiver.requestResume();
    await clock.advanceAsync(50);
    channel.deliverPackets();

    const maxTime2 = clock.now() + 200000;
    while (clock.now() < maxTime2 && deliveryCount === 0) {
      await clock.advanceAsync(10);
      channel.deliverPackets();

      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        if (deliveryCount > 0) break;
        await Promise.resolve();
        if (!clock.hasPendingTimers() && channel.getQueueSize() === 0) break;
      }
    }

    expect(deliveredPayload).not.toBeNull();
    expect(deliveredPayload!.equals(testPayload)).toBe(true);
    expect(deliveryCount).toBe(1);
    expect(receiver.getState()).toBe('COMPLETED');
  });

  it('rejects resume request with wrong transfer ID', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(8000);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    }, rng, clock);

    const sender = new Sender(senderTransport, {}, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    const testPayload = Buffer.from('WRONG_TRANSFER_ID_TEST_' + 'W'.repeat(1000));
    let resumeRejected = false;

    sender.on('event', (event: { event: string }) => {
      if (event.event === 'resume_rejected') {
        resumeRejected = true;
      }
    });

    await sender.startTransfer(testPayload, 'wrong_id_test');

    channel.setDisconnectAfterDeliveredPackets(2);

    while (clock.now() < 200000 && sender.getState() !== 'RESUMING') {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        await Promise.resolve();
      }
    }

    expect(sender['chunks'].length).toBeGreaterThan(0);
    expect(sender.getState()).toBe('RESUMING');

    channel.reconnect();

    const wrongTransferId = Buffer.alloc(16, 0xFF);
    const buffer = Buffer.alloc(3 + 16 + 2);
    buffer.writeUInt8(0x20, 0);
    buffer.writeUInt16BE(0, 1);
    wrongTransferId.copy(buffer, 3);

    const rxChunksBeforeBadResume = receiver.getReceivedChunkSeqs().length;

    senderTransport.receiveData(buffer);
    await clock.advanceAsync(100);
    channel.deliverPackets();

    expect(resumeRejected).toBe(true);

    await clock.advanceAsync(500);
    channel.deliverPackets();

    expect(receiver.getReceivedChunkSeqs().length).toBe(rxChunksBeforeBadResume);
  });
});
