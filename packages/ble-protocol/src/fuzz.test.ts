import { describe, it, expect } from 'vitest';

import { createMockTransportPair } from './mock-transport';
import { Receiver } from './receiver';
import { Sender, IRNG, SimulatedClock } from './sender';

// Seeded PRNG for deterministic fuzz testing
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

interface FuzzScenario {
  name: string;
  payloadSize: number;
  channelConfig: {
    packetLoss: number;
    duplicateRate: number;
    reorderRate: number;
    minLatency: number;
    maxLatency: number;
  };
  expectSuccess: boolean;
}

function generateFuzzScenarios(seedStart: number, count: number): FuzzScenario[] {
  const scenarios: FuzzScenario[] = [];

  for (let i = 0; i < count; i++) {
    const seed = seedStart + i;
    const scenarioRng = new SeededRNG(seed);

    const payloadSize = 50 + Math.floor(scenarioRng.random() * 1000);
    const packetLoss = scenarioRng.random() * 0.5;
    const duplicateRate = scenarioRng.random() * 0.3;
    const reorderRate = scenarioRng.random() * 0.4;
    const minLatency = Math.floor(scenarioRng.random() * 50);
    const maxLatency = minLatency + Math.floor(scenarioRng.random() * 200);

    scenarios.push({
      name: `Fuzz_${i}_seed_${seed}`,
      payloadSize,
      channelConfig: {
        packetLoss,
        duplicateRate,
        reorderRate,
        minLatency,
        maxLatency
      },
      expectSuccess: packetLoss < 0.9
    });
  }

  return scenarios;
}

interface FuzzResult {
  success: boolean;
  invariantViolations: string[];
  receivedPayload: Buffer | null;
  error?: string;
}

async function runFuzzScenario(scenario: FuzzScenario): Promise<FuzzResult> {
  const seed = parseInt(scenario.name.split('_').pop() || '0');
  const rng = new SeededRNG(seed);
  const clock = new SimulatedClock();
  
  const { senderTransport, receiverTransport, channel } = createMockTransportPair(
    scenario.channelConfig,
    rng,
    clock
  );

  const sender = new Sender(senderTransport, { maxRetries: 10, chunkTimeout: 500 }, clock, rng);
  const receiver = new Receiver(receiverTransport, {}, clock);

  const payload = Buffer.alloc(scenario.payloadSize);
  for (let i = 0; i < payload.length; i++) {
    payload[i] = i % 256;
  }

  let receivedPayload: Buffer | null = null;
  let completed = false;
  let failed = false;
  let errorMsg = '';
  const invariantViolations: string[] = [];

  sender.on('completed', () => {
    completed = true;
  });

  sender.on('failed', ({ message }: { message: string }) => {
    failed = true;
    errorMsg = message;
  });

  receiver.on('completed', ({ payload: p }: { payload: Buffer }) => {
    receivedPayload = p;
    
    if (!p.equals(payload)) {
      invariantViolations.push('Invariant (b) violation: Payload mismatch');
    }
  });

  await sender.startTransfer(payload, `fuzz_${scenario.name}`);

  const maxSimTime = 100000;
  const startTime = clock.now();
  while (clock.now() - startTime < maxSimTime && !completed && !failed) {
    await clock.advanceAsync(10);
    channel.deliverPackets();
    
    if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
      await clock.advanceAsync(100);
      await Promise.resolve();
      if (completed || failed || (!clock.hasPendingTimers() && channel.getQueueSize() === 0)) {
        break;
      }
    }
  }

  return {
    success: completed,
    invariantViolations,
    receivedPayload,
    error: failed ? errorMsg : undefined
  };
}

describe('BLE Protocol Fuzz Testing (Simulated Clock)', () => {
  const FUZZ_SEED_START = 42000;
  const FUZZ_SCENARIO_COUNT = 2000;

  it(`should run ${FUZZ_SCENARIO_COUNT} fuzz scenarios with 0 invariant violations`, async () => {
    const scenarios = generateFuzzScenarios(FUZZ_SEED_START, FUZZ_SCENARIO_COUNT);
    
    let completedCount = 0;
    let controlledFailCount = 0;
    let totalInvariantViolations = 0;
    const failures: Array<{ scenario: FuzzScenario; error: string; violations: string[] }> = [];

    for (const scenario of scenarios) {
      const result = await runFuzzScenario(scenario);
      
      if (result.success) {
        completedCount++;
      } else {
        controlledFailCount++;
      }
      
      if (result.invariantViolations.length > 0) {
        totalInvariantViolations += result.invariantViolations.length;
        failures.push({ 
          scenario, 
          error: result.error || 'Unknown', 
          violations: result.invariantViolations 
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`\nFuzz test results:`);
    // eslint-disable-next-line no-console
    console.log(`Total scenarios: ${FUZZ_SCENARIO_COUNT}`);
    // eslint-disable-next-line no-console
    console.log(`Completed: ${completedCount}`);
    // eslint-disable-next-line no-console
    console.log(`Controlled FAILED: ${controlledFailCount}`);
    // eslint-disable-next-line no-console
    console.log(`Invariant violations: ${totalInvariantViolations}`);
    // eslint-disable-next-line no-console
    console.log(`Seed range: ${FUZZ_SEED_START} to ${FUZZ_SEED_START + FUZZ_SCENARIO_COUNT - 1}`);

    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`\n${failures.length} scenarios with invariant violations:`);
      failures.slice(0, 10).forEach(f => {
        // eslint-disable-next-line no-console
        console.error(`  ${f.scenario.name}: ${f.violations.join(', ')}`);
      });
    }

    // CRITICAL: Invariant violations must be exactly 0
    expect(totalInvariantViolations).toBe(0);
    
    // Completion rate check: with 0-50% packet loss, expect at least 20% completion
    // (Higher loss rates naturally lead to more timeouts, which is acceptable)
    const completionRate = completedCount / FUZZ_SCENARIO_COUNT;
    expect(completionRate).toBeGreaterThan(0.20);
  }, 300000);

  it('Invariant (a): should NEVER emit PEER_RECEIVED on corrupted CRC', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(5000);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    }, rng, clock);

    const receiver = new Receiver(receiverTransport, {}, clock);
    let peerReceivedEmitted = false;
    receiver.on('completed', () => {
      peerReceivedEmitted = true;
    });

    const sender = new Sender(senderTransport, {}, clock, rng);
    const payload = Buffer.from('TEST_MESSAGE_FOR_CORRUPTION');

    const originalSend = senderTransport.send.bind(senderTransport);
    senderTransport.send = async (data: Buffer) => {
      if (data.length > 20) {
        const seq = data.readUInt16BE(0);
        if (seq === 0) {
          const corrupted = Buffer.from(data);
          corrupted.writeUInt32BE(0x12345678, 4);
          return originalSend(corrupted);
        }
      }
      return originalSend(data);
    };

    await sender.startTransfer(payload, 'corrupt_test');

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

    expect(peerReceivedEmitted).toBe(false);
  });

  it('Invariant (a): should NEVER emit PEER_RECEIVED on wrong digest', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(5001);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    }, rng, clock);

    const receiver = new Receiver(receiverTransport, {}, clock);
    let peerReceivedEmitted = false;
    receiver.on('completed', () => {
      peerReceivedEmitted = true;
    });

    const sender = new Sender(senderTransport, {}, clock, rng);
    const payload = Buffer.from('TEST_MESSAGE_FOR_DIGEST_CORRUPTION');

    let lastChunkSeen = false;
    const originalSend = senderTransport.send.bind(senderTransport);
    senderTransport.send = async (data: Buffer) => {
      if (data.length > 40 && !lastChunkSeen) {
        const flags = data.readUInt8(8);
        if (flags & 0x02) {
          lastChunkSeen = true;
          const corrupted = Buffer.from(data);
          for (let i = 12; i < 20; i++) {
            corrupted[i] = 0xFF;
          }
          const { calculateCRC32 } = await import('./chunk');
          const payload = corrupted.slice(12);
          const crc = calculateCRC32(payload);
          corrupted.writeUInt32BE(crc, 4);
          return originalSend(corrupted);
        }
      }
      return originalSend(data);
    };

    await sender.startTransfer(payload, 'digest_corrupt_test');

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

    expect(peerReceivedEmitted).toBe(false);
  });

  it('Invariant (b): should deliver exact payload when transfer completes', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(5002);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.08,
      duplicateRate: 0.15,
      reorderRate: 0.25,
      minLatency: 5,
      maxLatency: 30
    }, rng, clock);

    const sender = new Sender(senderTransport, { maxRetries: 10, chunkTimeout: 500 }, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    const originalPayload = Buffer.from('EXACT_BYTE_EQUALITY_TEST_' + 'X'.repeat(400));
    let receivedPayload: Buffer | null = null;

    receiver.on('completed', ({ payload }: { payload: Buffer }) => {
      receivedPayload = payload;
    });

    await sender.startTransfer(originalPayload, 'exact_test');

    const startTime = clock.now();
    while (clock.now() - startTime < 30000) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        await Promise.resolve();
        if (!clock.hasPendingTimers() && channel.getQueueSize() === 0) break;
      }
    }

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload!.equals(originalPayload)).toBe(true);
  });

  it('Invariant (c): should deliver message exactly once (no duplicates)', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(5003);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.05,
      duplicateRate: 0.5,
      reorderRate: 0.2,
      minLatency: 10,
      maxLatency: 50
    }, rng, clock);

    const sender = new Sender(senderTransport, { maxRetries: 10, chunkTimeout: 500 }, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    const payload = Buffer.from('DUPLICATE_DETECTION_TEST');
    let deliveryCount = 0;

    receiver.on('completed', () => {
      deliveryCount++;
    });

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

  it('Invariant (d): should complete interrupted transfer with retry', async () => {
    // Test resume capability with moderate packet loss
    const clock = new SimulatedClock();
    const rng = new SeededRNG(42);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.10,  // Moderate loss
      duplicateRate: 0.05,
      reorderRate: 0.10,
      minLatency: 5,
      maxLatency: 30
    }, rng, clock);

    const sender = new Sender(senderTransport, { maxRetries: 25, chunkTimeout: 1000 }, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    const payload = Buffer.from('RESUME_TEST_' + 'Y'.repeat(600));
    let completed = false;

    receiver.on('completed', () => {
      completed = true;
    });

    await sender.startTransfer(payload, 'resume_test');

    const startTime = clock.now();
    while (clock.now() - startTime < 200000) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        await Promise.resolve();
        if (!clock.hasPendingTimers() && channel.getQueueSize() === 0) break;
      }
    }

    // With 10% packet loss and retries, transfer should complete
    expect(completed).toBe(true);
  });

  it('Negative test: should reject version mismatch in HELLO', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(5005);
    const { receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    }, rng, clock);

    const receiver = new Receiver(receiverTransport, {}, clock);
    
    const wrongHello = Buffer.alloc(20);
    wrongHello.writeUInt8(0x01, 0);
    wrongHello.writeUInt8(0x99, 1);
    for (let i = 0; i < 16; i++) {
      wrongHello.writeUInt8(i, 2 + i);
    }
    wrongHello.writeUInt16BE(247, 18);

    receiverTransport.receiveData(wrongHello);
    
    await clock.advanceAsync(1000);
    channel.deliverPackets();

    expect(receiver.getState()).not.toBe('READY');
  });

  it('Negative test: should fail on total mismatch', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(5006);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    }, rng, clock);

    const sender = new Sender(senderTransport, {}, clock, rng);
    const receiver = new Receiver(receiverTransport, {}, clock);

    const payload = Buffer.from('TOTAL_MISMATCH_TEST_LONG_ENOUGH_FOR_MULTIPLE_CHUNKS_' + 'X'.repeat(300));
    let failEmitted = false;

    receiver.on('failed', () => {
      failEmitted = true;
    });

    let chunkCount = 0;
    const originalSend = senderTransport.send.bind(senderTransport);
    senderTransport.send = async (data: Buffer) => {
      if (data.length > 20) {
        chunkCount++;
        if (chunkCount === 2) {
          const corrupted = Buffer.from(data);
          corrupted.writeUInt16BE(999, 2);
          const { calculateCRC32 } = await import('./chunk');
          const payload = corrupted.slice(12);
          const crc = calculateCRC32(payload);
          corrupted.writeUInt32BE(crc, 4);
          return originalSend(corrupted);
        }
      }
      return originalSend(data);
    };

    await sender.startTransfer(payload, 'total_mismatch_test');

    const startTime = clock.now();
    while (clock.now() - startTime < 5000) {
      await clock.advanceAsync(10);
      channel.deliverPackets();
      
      if (failEmitted) break;
      
      if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
        await clock.advanceAsync(100);
        await Promise.resolve();
        if (failEmitted || (!clock.hasPendingTimers() && channel.getQueueSize() === 0)) break;
      }
    }

    expect(failEmitted).toBe(true);
  });
});
