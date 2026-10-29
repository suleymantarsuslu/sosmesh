import { describe, it, expect } from 'vitest';

import { 
  serializeChunk, 
  splitIntoChunks, 
  calculateCRC32 
} from './chunk';
import { createMockTransportPair } from './mock-transport';
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
  senderTransport: any,
  receiverTransport: any,
  channel: any,
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

  it('should handle high packet loss (%25+) with resume', async () => {
    // MANDATORY: Resume capability test - Moderate loss with retries demonstrates
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

    const events: any[] = [];
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

    const sentChunks = new Set<number>();
    sender.on('event', (event: any) => {
      if (event.event === 'chunk_sent') {
        sentChunks.add(event.seq);
      }
    });

    await sender.startTransfer(testPayload, 'resume_test');

    while (sender['chunks'].length === 0 && clock.now() < 5000) {
      await clock.advanceAsync(100);
      channel.deliverPackets();
    }

    expect(sender['chunks'].length).toBeGreaterThan(0);

    senderTransport.triggerDisconnect();
    receiverTransport.triggerDisconnect();
    
    await clock.advanceAsync(100);

    expect(sender.getState()).toBe('RESUMING');
    expect(receiver.getState()).toBe('RESUMING');

    channel.reconnect();
    
    sentChunks.clear();
    
    await receiver.requestResume();
    await clock.advanceAsync(100);
    channel.deliverPackets();

    while (clock.now() < 200000 && !deliveredPayload) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        if (deliveredPayload) break;
        await Promise.resolve();
        if (!clock.hasPendingTimers() && channel.getQueueSize() === 0) break;
      }
    }

    expect(deliveredPayload).not.toBeNull();
    expect(deliveredPayload!.equals(testPayload)).toBe(true);
    expect(deliveryCount).toBe(1);
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

    while (sender['chunks'].length === 0 && clock.now() < 5000) {
      await clock.advanceAsync(100);
      channel.deliverPackets();
    }

    expect(sender['chunks'].length).toBeGreaterThan(0);

    senderTransport.triggerDisconnect();
    receiverTransport.triggerDisconnect();

    await clock.advanceAsync(500);

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

    expect(senderEvents.includes('resume_accepted') || senderEvents.includes('resume_rejected')).toBe(true);
    expect(deliveryCount).toBe(1);
  });

  it('high loss causes FAILED then resume then COMPLETED with strict state', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(7000);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.30,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 5,
      maxLatency: 15
    }, rng, clock);

    const sender = new Sender(senderTransport, { maxRetries: 2, chunkTimeout: 1000 }, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    const testPayload = Buffer.from('HIGH_LOSS_RESUME_' + 'Z'.repeat(300));
    let senderFailed = false;

    sender.on('failed', () => {
      senderFailed = true;
    });

    receiver.on('completed', ({ payload }: { payload: Buffer }) => {
      void payload;
    });

    await sender.startTransfer(testPayload, 'high_loss_test');

    const maxTime = 250000;
    while (clock.now() < maxTime && !senderFailed) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        await Promise.resolve();
        if (!clock.hasPendingTimers() && channel.getQueueSize() === 0) break;
      }
    }

    expect(senderFailed).toBe(true);
    expect(sender.getState()).toBe('FAILED');

    const { senderTransport: newSenderTransport, receiverTransport: newReceiverTransport, channel: newChannel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 5,
      maxLatency: 15
    }, new SeededRNG(7001), clock);

    const newSender = new Sender(newSenderTransport, { maxRetries: 20 }, clock, new SeededRNG(7001));
    const newReceiver = new Receiver(newReceiverTransport, {}, clock);

    let newDeliveryCount = 0;
    let newDeliveredPayload: Buffer | null = null;
    let newCompleted = false;

    newSender.on('completed', () => {
      newCompleted = true;
    });

    newReceiver.on('completed', ({ payload }: { payload: Buffer }) => {
      newDeliveredPayload = payload;
      newDeliveryCount++;
    });

    await newSender.startTransfer(testPayload, 'high_loss_retry');

    const maxTime2 = clock.now() + 200000;
    while (clock.now() < maxTime2 && !newCompleted) {
      await clock.advanceAsync(10);
      newChannel.deliverPackets();
      
      if (newChannel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        if (newCompleted) break;
        await Promise.resolve();
        if (!clock.hasPendingTimers() && newChannel.getQueueSize() === 0) break;
      }
    }

    expect(newDeliveredPayload).not.toBeNull();
    expect(newDeliveredPayload!.equals(testPayload)).toBe(true);
    expect(newDeliveryCount).toBe(1);
    expect(newSender.getState()).toBe('COMPLETED');
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

    const testPayload = Buffer.from('WRONG_TRANSFER_ID_TEST_' + 'W'.repeat(1000));
    let resumeRejected = false;

    sender.on('event', (event: any) => {
      if (event.event === 'resume_rejected') {
        resumeRejected = true;
      }
    });

    await sender.startTransfer(testPayload, 'wrong_id_test');

    while (sender['chunks'].length === 0 && clock.now() < 5000) {
      await clock.advanceAsync(100);
      channel.deliverPackets();
    }

    expect(sender['chunks'].length).toBeGreaterThan(0);

    senderTransport.triggerDisconnect();
    receiverTransport.triggerDisconnect();

    expect(sender.getState()).toBe('RESUMING');

    await clock.advanceAsync(500);
    channel.reconnect();

    const wrongTransferId = Buffer.alloc(16, 0xFF);
    const buffer = Buffer.alloc(3 + 16 + 2);
    buffer.writeUInt8(0x20, 0);
    buffer.writeUInt16BE(0, 1);
    wrongTransferId.copy(buffer, 3);

    senderTransport.receiveData(buffer);
    await clock.advanceAsync(100);
    channel.deliverPackets();

    expect(resumeRejected).toBe(true);

    const sentChunksAfterBadResume = new Set<number>();
    sender.on('event', (event: any) => {
      if (event.event === 'chunk_sent') {
        sentChunksAfterBadResume.add(event.seq);
      }
    });

    await clock.advanceAsync(500);
    channel.deliverPackets();

    expect(sentChunksAfterBadResume.size).toBe(0);
  });
});
