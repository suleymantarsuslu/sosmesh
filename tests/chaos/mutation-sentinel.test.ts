
import { MeshRelayEngine, type MeshRelayEnvelopeV2 } from '@sosmesh/contracts';
import { createMeshRelayEngineForTesting } from '@sosmesh/contracts/dist/protocol-v2/mesh-relay-engine.testing';
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

    const relayHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const envelope: MeshRelayEnvelopeV2 = {
      protocolVersion: 2,
      messageId: 'chaos-mut-ttl',
      hopCount: 0,
      maxHops: 5,
      ttlHops: 0,
      copyCount: 1,
      maxCopyCount: 3,
      originCreatedAt: '2026-11-01T12:00:00Z',
      opaqueCiphertextBase64: 'dGVzdA==',
      hopChainReceipt: { relayDeviceIdHashes: [] },
    };
    const production = new MeshRelayEngine({ lruCapacity: 256 }).evaluateForward(envelope, relayHash);
    expect(production.dropReason).toBe('TTL_EXCEEDED');

    const mutated = createMeshRelayEngineForTesting({
      lruCapacity: 256,
      skipTtlDecrement: true,
    }).evaluateForward(envelope, relayHash);
    expect(mutated.decision).toBe('FORWARD');
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
        partialCorruptRate: 1,
      },
    });
    expect(result.report.outcome).not.toBe('COMPLETED');
  });
});
