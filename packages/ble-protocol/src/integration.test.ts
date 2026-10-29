import { describe, it, expect } from 'vitest';

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
  maxSimTime: number = 200000
): Promise<{ success: boolean; receivedPayload: Buffer | null; error?: string }> {
  const sender = new Sender(senderTransport, { maxRetries: 20, chunkTimeout: 1000 }, clock, new SeededRNG(1000));
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

  it('should handle packet loss with retries', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(2);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.01,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 5,
      maxLatency: 15
    }, rng, clock);

    const testPayload = Buffer.from('TEST_WITH_PACKET_LOSS_' + 'X'.repeat(250));

    const result = await runSimulatedTransfer(
      senderTransport, 
      receiverTransport, 
      channel, 
      clock, 
      testPayload, 
      'loss_test',
      250000
    );

    expect(result.success).toBe(true);
    expect(result.receivedPayload).not.toBeNull();
    expect(result.receivedPayload!.equals(testPayload)).toBe(true);
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
});
