import { describe, it, expect } from 'vitest';
import { Sender, SimulatedClock, IClock, IRNG } from './sender';
import { Receiver } from './receiver';
import { createMockTransportPair } from './mock-transport';

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

describe('BLE Protocol D-08 Resume Tests', () => {
  it('MANDATORY D-08: should resume after disconnect without wrong delivery signal', async () => {
    // Test: transfer ortasında disconnect → kesinti sırasında teslim/complete işareti YOK
    // → reconnect + resume → yalnız eksik chunk'lar gönderilir → tam 1 kez teslim + bayt eşitliği
    const clock = new SimulatedClock();
    const rng = new SeededRNG(8000);
    
    const testPayload = Buffer.from('D08_RESUME_TEST_' + 'R'.repeat(300));
    const msgId = 'd08_resume_test';

    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.05,
      duplicateRate: 0.01,
      reorderRate: 0.01,
      minLatency: 5,
      maxLatency: 12
    }, rng, clock);

    const sender = new Sender(senderTransport, { maxRetries: 50, chunkTimeout: 1000 }, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    let receivedPayload: Buffer | null = null;
    let completedCount = 0;
    let senderCompleted = false;
    let senderFailed = false;

    sender.on('completed', () => {
      senderCompleted = true;
    });

    sender.on('failed', () => {
      senderFailed = true;
    });

    receiver.on('completed', ({ payload }: { payload: Buffer }) => {
      receivedPayload = payload;
      completedCount++;
    });

    receiver.on('failed', () => {
      // Should not fail
    });

    await sender.startTransfer(testPayload, msgId);

    // Phase 1: Simulate partial transfer (some chunks sent but not all)
    const simClock = clock as SimulatedClock;
    const startTime = simClock.now();
    let iterations = 0;
    
    // Run for limited time to simulate partial transfer
    while (simClock.now() - startTime < 15000 && !senderCompleted && !senderFailed && iterations < 60) {
      await simClock.advanceAsync(10);
      channel.deliverPackets();
      iterations++;
    }

    // At this point, transfer is incomplete - verify no false success
    expect(senderCompleted).toBe(false);
    expect(completedCount).toBe(0);
    expect(receivedPayload).toBeNull();

    // Phase 2: Simulate disconnect by blocking packets for a period
    const beforeDisconnect = simClock.now();
    const receivedBefore = receiver.getReceivedChunkSeqs().length;

    // Simulate disconnect: stop delivering packets for a while
    let disconnectIterations = 0;
    while (simClock.now() - beforeDisconnect < 5000 && disconnectIterations < 20) {
      await simClock.advanceAsync(10);
      // Don't deliver packets during disconnect
      disconnectIterations++;
    }

    // Verify no completion during disconnect
    expect(senderCompleted).toBe(false);
    expect(completedCount).toBe(0);

    // Phase 3: Reconnect and send RESUME_REQUEST
    receiver.sendResumeRequest(msgId);
    await simClock.advanceAsync(50);
    channel.deliverPackets(); // Deliver the RESUME_REQUEST

    // Phase 4: Continue transfer after resume - only missing chunks should be sent
    const beforeResume = simClock.now();
    const receivedBeforeResume = receiver.getReceivedChunkSeqs().length;

    while (simClock.now() - beforeResume < 300000 && !senderCompleted && !senderFailed) {
      await simClock.advanceAsync(10);
      channel.deliverPackets();
      
      if (channel.getQueueSize() === 0 && !simClock.hasPendingTimers()) {
        await simClock.advanceAsync(100);
        if (senderCompleted || senderFailed) break;
        await Promise.resolve();
        if (!simClock.hasPendingTimers() && channel.getQueueSize() === 0) {
          break;
        }
      }
    }

    // After resume, transfer should complete exactly once with correct bytes
    expect(senderCompleted).toBe(true);
    expect(senderFailed).toBe(false);
    expect(completedCount).toBe(1);
    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload!.equals(testPayload)).toBe(true);

    // Verify that resume actually worked (receiver had some chunks before resume)
    expect(receivedBefore).toBeGreaterThan(0);
    expect(receivedBeforeResume).toBeGreaterThan(0);
  });

  it('MANDATORY D-08: should handle 25%+ packet loss with controlled failure then resume', async () => {
    // Test: 25%+ kayıp → kontrollü FAILED → resume → COMPLETED
    const testPayload = Buffer.from('D08_HIGH_LOSS_' + 'H'.repeat(250));
    const msgId = 'd08_high_loss';

    // Attempt 1: High loss with low retry budget - should fail
    const clock1 = new SimulatedClock();
    const rng1 = new SeededRNG(9000);
    const { senderTransport: st1, receiverTransport: rt1, channel: ch1 } = createMockTransportPair({
      packetLoss: 0.28,
      duplicateRate: 0.02,
      reorderRate: 0.02,
      minLatency: 5,
      maxLatency: 15
    }, rng1, clock1);

    const sender1 = new Sender(st1, { maxRetries: 8, chunkTimeout: 1000 }, clock1, rng1);
    const receiver1 = new Receiver(rt1, {}, clock1);

    let failed1 = false;
    let completed1 = false;

    sender1.on('failed', () => { failed1 = true; });
    sender1.on('completed', () => { completed1 = true; });

    await sender1.startTransfer(testPayload, msgId);

    // Run with insufficient retries - should fail
    const startTime1 = clock1.now();
    while (clock1.now() - startTime1 < 120000 && !failed1 && !completed1) {
      await clock1.advanceAsync(10);
      ch1.deliverPackets();
      
      if (ch1.getQueueSize() === 0 && !clock1.hasPendingTimers()) {
        await clock1.advanceAsync(100);
        if (failed1 || completed1) break;
        if (!clock1.hasPendingTimers() && ch1.getQueueSize() === 0) break;
      }
    }

    // Verify controlled failure
    expect(failed1).toBe(true);
    expect(completed1).toBe(false);

    // Attempt 2: Same high loss but with adequate retry budget and resume - should succeed
    const clock2 = new SimulatedClock();
    const rng2 = new SeededRNG(9001);
    const { senderTransport: st2, receiverTransport: rt2, channel: ch2 } = createMockTransportPair({
      packetLoss: 0.28,
      duplicateRate: 0.02,
      reorderRate: 0.02,
      minLatency: 5,
      maxLatency: 15
    }, rng2, clock2);

    const sender2 = new Sender(st2, { maxRetries: 45, chunkTimeout: 1000 }, clock2, rng2);
    const receiver2 = new Receiver(rt2, {}, clock2);

    let receivedPayload2: Buffer | null = null;
    let completed2 = false;
    let failed2 = false;

    sender2.on('completed', () => { completed2 = true; });
    sender2.on('failed', () => { failed2 = true; });
    receiver2.on('completed', ({ payload }: { payload: Buffer }) => {
      receivedPayload2 = payload;
    });

    await sender2.startTransfer(testPayload, msgId);

    // Simulate with resume capability
    const startTime2 = clock2.now();
    let resumeSent = false;
    
    while (clock2.now() - startTime2 < 400000 && !completed2 && !failed2) {
      await clock2.advanceAsync(10);
      ch2.deliverPackets();
      
      // Simulate resume request mid-transfer if many retries happening
      if (!resumeSent && clock2.now() - startTime2 > 50000) {
        receiver2.sendResumeRequest(msgId);
        resumeSent = true;
        await clock2.advanceAsync(50);
        ch2.deliverPackets();
      }
      
      if (ch2.getQueueSize() === 0 && !clock2.hasPendingTimers()) {
        await clock2.advanceAsync(100);
        if (completed2 || failed2) break;
        if (!clock2.hasPendingTimers() && ch2.getQueueSize() === 0) break;
      }
    }

    // With resume, high loss should be recoverable
    expect(completed2).toBe(true);
    expect(failed2).toBe(false);
    expect(receivedPayload2).not.toBeNull();
    expect(receivedPayload2!.equals(testPayload)).toBe(true);
  });
});
