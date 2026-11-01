
import { calculateDigest, verifyDigest } from '@sosmesh/ble-protocol';
import { runSimulatedTransfer, runTtlExceededScenario } from '@sosmesh/mesh-simulator';
import { describe, expect, it } from 'vitest';

/**
 * Mutation sentinel tests — production code must keep digest verification and TTL decrement.
 * Full mutation harness: scripts/mesh-sim-mutation.sh (run manually in ADIM 11 checklist).
 */
describe('chaos_mutation_sentinel_digest_and_ttl', () => {
  it('chaos_mutation_sentinel_digest_verification_enabled_in_receiver', () => {
    const payload = Buffer.from('mutation-sentinel-payload');
    const digest = calculateDigest(payload);
    expect(verifyDigest(payload, digest)).toBe(true);
    expect(verifyDigest(payload, Buffer.alloc(32, 0xab))).toBe(false);
  });

  it('chaos_mutation_sentinel_ttl_drop_without_decrement_would_fail', async () => {
    const baseline = await runTtlExceededScenario(501);
    expect(baseline.report.outcome).toBe('DROPPED');

    const { runMultiHopRelay } = await import('@sosmesh/mesh-simulator');
    const skipDecrement = await runMultiHopRelay({
      seed: 501,
      initialTtl: 0,
      skipTtlDecrement: true,
      reliableChannel: true,
    });
    expect(skipDecrement.report.outcome).not.toBe('DROPPED');
  });
});

describe('chaos_mutation_sentinel_unverified_not_completed', () => {
  it('chaos_mutation_sentinel_corrupt_never_completed', async () => {
    const result = await runSimulatedTransfer({
      seed: 1234,
      scenario: 'mutation-sentinel',
      channel: {
        packetLoss: 0,
        duplicateRate: 0,
        reorderRate: 0,
        minLatency: 1,
        maxLatency: 2,
        partialWriteRate: 0,
      },
      injectCorruptLastChunk: true,
    });
    expect(result.report.outcome).not.toBe('COMPLETED');
  });
});
