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
  maxSimTime: number = 100000
): Promise<{ success: boolean; receivedPayload: Buffer | null; error?: string }> {
  const sender = new Sender(senderTransport, { maxRetries: 10, chunkTimeout: 500 }, clock, new SeededRNG(1000));
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
    simClock.advance(10);
    channel.deliverPackets();
    
    if (channel.getQueueSize() === 0 && !simClock.hasPendingTimers()) {
      break;
    }
  }

  // Don't close until simulation is done
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

    channel.close();
  });

  it('should handle packet loss with retries', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(100);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.15,
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
      50000
    );

    expect(result.success).toBe(true);
    expect(result.receivedPayload).not.toBeNull();
    expect(result.receivedPayload!.equals(testPayload)).toBe(true);

    channel.close();
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
      50000
    );

    expect(result.success).toBe(true);
    expect(result.receivedPayload).not.toBeNull();
    expect(result.receivedPayload!.equals(testPayload)).toBe(true);

    channel.close();
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

    const simClock = clock as SimulatedClock;
    const startTime = simClock.now();
    while (simClock.now() - startTime < 10000) {
      simClock.advance(10);
      channel.deliverPackets();
      
      if (channel.getQueueSize() === 0 && !simClock.hasPendingTimers()) {
        break;
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

    const simClock = clock as SimulatedClock;
    while (simClock.hasPendingTimers() || channel.getQueueSize() > 0) {
      simClock.advance(10);
      channel.deliverPackets();
      
      if (simClock.now() > 50000) break;
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
    expect(events.some(e => e.event === 'chunk_sent')).toBe(true);
  });
});
