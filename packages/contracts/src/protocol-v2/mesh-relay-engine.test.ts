import * as fs from 'fs';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

import { createMeshRelayEngineForTesting } from './mesh-relay-engine.testing';
import {
  MeshRelayEngine,
  type MeshRelayEnvelopeV2,
  buildDedupKey,
  relayLogSnapshot,
} from './mesh-relay-engine';

interface VectorCase {
  id: string;
  relayDeviceIdHash: string;
  envelope: MeshRelayEnvelopeV2;
  previouslySeenDedupKey?: string;
  expect: {
    decision: 'FORWARD' | 'DROP';
    dropReason?: string;
    forwardHopCount?: number;
    forwardTtlHops?: number;
    forwardCopyCount?: number;
  };
}

const vectorsPath = path.join(
  __dirname,
  '../../protocol-v2/vectors/relay-engine-cases.json'
);

describe('protocol_v2_mesh_relay_engine_vectors', () => {
  const { cases } = JSON.parse(fs.readFileSync(vectorsPath, 'utf-8')) as {
    cases: VectorCase[];
  };

  it.each(cases.map((c) => [c.id, c] as const))('%s matches golden outcome', (_id, vector) => {
    const engine = new MeshRelayEngine({ lruCapacity: 256 });
    if (vector.previouslySeenDedupKey) {
      engine.seedDedupKey(vector.previouslySeenDedupKey);
    }
    const outcome = engine.evaluateForward(vector.envelope, vector.relayDeviceIdHash);
    expect(outcome.decision).toBe(vector.expect.decision);
    if (vector.expect.dropReason) {
      expect(outcome.dropReason).toBe(vector.expect.dropReason);
    }
    if (vector.expect.decision === 'FORWARD') {
      expect(outcome.forward).toBeDefined();
      expect(outcome.forward?.hopCount).toBe(vector.expect.forwardHopCount);
      expect(outcome.forward?.ttlHops).toBe(vector.expect.forwardTtlHops);
      expect(outcome.forward?.copyCount).toBe(vector.expect.forwardCopyCount);
    }
  });
});

describe('protocol_v2_dedup_key_stable', () => {
  it('dedup_key_uses_message_hop_and_ciphertext_prefix', () => {
    const envelope: MeshRelayEnvelopeV2 = {
      protocolVersion: 2,
      messageId: 'abc',
      hopCount: 0,
      maxHops: 5,
      ttlHops: 2,
      copyCount: 1,
      maxCopyCount: 3,
      originCreatedAt: '2026-11-01T12:00:00Z',
      opaqueCiphertextBase64: 'ABCDEFGHijklmnop',
      hopChainReceipt: { relayDeviceIdHashes: [] },
    };
    expect(buildDedupKey(envelope)).toBe('abc:0:ABCDEFGH');
  });
});

describe('protocol_v2_relay_log_snapshot_opaque', () => {
  it('relay_log_snapshot_uses_metadata_and_ciphertext_prefix_only', () => {
    const plaintextNote = 'مرحبا İstanbul 🚨 SENTETIK_YARDIM';
    const envelope: MeshRelayEnvelopeV2 = {
      protocolVersion: 2,
      messageId: 'snap-001',
      hopCount: 1,
      maxHops: 5,
      ttlHops: 2,
      copyCount: 1,
      maxCopyCount: 3,
      originCreatedAt: '2026-11-01T12:00:00Z',
      opaqueCiphertextBase64: Buffer.from(plaintextNote, 'utf-8').toString('base64'),
      hopChainReceipt: { relayDeviceIdHashes: [] },
    };
    const snapshot = relayLogSnapshot(envelope);
    expect(snapshot).toContain('"messageId":"snap-001"');
    expect(snapshot).not.toContain(plaintextNote);
    expect(snapshot).not.toContain('مرحبا');
    expect(snapshot).not.toContain('İstanbul');
    expect(JSON.parse(snapshot).ciphertextPrefix).toBe(
      envelope.opaqueCiphertextBase64.slice(0, 24)
    );
    expect(snapshot.length).toBeLessThan(JSON.stringify(envelope).length);
  });
});

describe('protocol_v2_production_relay_guards', () => {
  const relayHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  const baseEnvelope = (): MeshRelayEnvelopeV2 => ({
    protocolVersion: 2,
    messageId: 'prod-guard',
    hopCount: 0,
    maxHops: 5,
    ttlHops: 2,
    copyCount: 1,
    maxCopyCount: 3,
    originCreatedAt: '2026-11-01T12:00:00Z',
    opaqueCiphertextBase64: 'dGVzdA==',
    hopChainReceipt: { relayDeviceIdHashes: [] },
  });

  it('public_mesh_relay_engine_enforces_ttl_dedup_loop_and_max_hops', () => {
    const engine = new MeshRelayEngine({ lruCapacity: 16 });

    const ttlZero = { ...baseEnvelope(), messageId: 'ttl0', ttlHops: 0 };
    expect(engine.evaluateForward(ttlZero, relayHash).dropReason).toBe('TTL_EXCEEDED');

    const dupEnvelope = { ...baseEnvelope(), messageId: 'dup' };
    const dupKey = buildDedupKey(dupEnvelope);
    engine.seedDedupKey(dupKey);
    expect(engine.evaluateForward(dupEnvelope, relayHash).dropReason).toBe('DUPLICATE');

    const loopEnvelope = {
      ...baseEnvelope(),
      messageId: 'loop',
      hopCount: 1,
      hopChainReceipt: { relayDeviceIdHashes: [relayHash] },
    };
    expect(engine.evaluateForward(loopEnvelope, relayHash).dropReason).toBe('LOOP_DETECTED');

    const maxHopsEnvelope = {
      ...baseEnvelope(),
      messageId: 'maxhop',
      hopCount: 5,
      maxHops: 5,
    };
    expect(engine.evaluateForward(maxHopsEnvelope, relayHash).dropReason).toBe('MAX_HOPS');
  });
});

describe('protocol_v2_mutation_ttl_decrement', () => {
  it('skip_ttl_decrement_changes_drop_vs_baseline', () => {
    const envelope: MeshRelayEnvelopeV2 = {
      protocolVersion: 2,
      messageId: 'mut-ttl',
      hopCount: 0,
      maxHops: 5,
      ttlHops: 0,
      copyCount: 1,
      maxCopyCount: 3,
      originCreatedAt: '2026-11-01T12:00:00Z',
      opaqueCiphertextBase64: 'dGVzdA==',
      hopChainReceipt: { relayDeviceIdHashes: [] },
    };
    const relayHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const baseline = new MeshRelayEngine({ lruCapacity: 8 }).evaluateForward(envelope, relayHash);
    expect(baseline.decision).toBe('DROP');
    expect(baseline.dropReason).toBe('TTL_EXCEEDED');

    const mutated = createMeshRelayEngineForTesting({ lruCapacity: 8, skipTtlDecrement: true }).evaluateForward(
      envelope,
      relayHash
    );
    expect(mutated.decision).toBe('FORWARD');
  });
});

describe('protocol_v2_mutation_dedup_loop_and_hops', () => {
  const relayHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  it('skip_dedup_check_changes_duplicate_vs_baseline', () => {
    const envelope: MeshRelayEnvelopeV2 = {
      protocolVersion: 2,
      messageId: 'mut-dedup',
      hopCount: 0,
      maxHops: 5,
      ttlHops: 2,
      copyCount: 1,
      maxCopyCount: 3,
      originCreatedAt: '2026-11-01T12:00:00Z',
      opaqueCiphertextBase64: 'dGVzdA==',
      hopChainReceipt: { relayDeviceIdHashes: [] },
    };
    const key = buildDedupKey(envelope);
    const baseline = new MeshRelayEngine({ lruCapacity: 8 });
    baseline.seedDedupKey(key);
    expect(baseline.evaluateForward(envelope, relayHash).dropReason).toBe('DUPLICATE');

    const mutated = createMeshRelayEngineForTesting({ lruCapacity: 8, skipDedupCheck: true });
    mutated.seedDedupKey(key);
    expect(mutated.evaluateForward(envelope, relayHash).decision).toBe('FORWARD');
  });

  it('skip_loop_guard_changes_loop_detected_vs_baseline', () => {
    const envelope: MeshRelayEnvelopeV2 = {
      protocolVersion: 2,
      messageId: 'mut-loop',
      hopCount: 1,
      maxHops: 5,
      ttlHops: 2,
      copyCount: 1,
      maxCopyCount: 3,
      originCreatedAt: '2026-11-01T12:00:00Z',
      opaqueCiphertextBase64: 'dGVzdA==',
      hopChainReceipt: { relayDeviceIdHashes: [relayHash] },
    };
    const baseline = new MeshRelayEngine({ lruCapacity: 8 }).evaluateForward(envelope, relayHash);
    expect(baseline.dropReason).toBe('LOOP_DETECTED');

    const mutated = createMeshRelayEngineForTesting({ lruCapacity: 8, skipLoopGuard: true }).evaluateForward(
      envelope,
      relayHash
    );
    expect(mutated.decision).toBe('FORWARD');
  });

  it('skip_max_hops_check_changes_max_hops_vs_baseline', () => {
    const envelope: MeshRelayEnvelopeV2 = {
      protocolVersion: 2,
      messageId: 'mut-hops',
      hopCount: 5,
      maxHops: 5,
      ttlHops: 2,
      copyCount: 1,
      maxCopyCount: 3,
      originCreatedAt: '2026-11-01T12:00:00Z',
      opaqueCiphertextBase64: 'dGVzdA==',
      hopChainReceipt: { relayDeviceIdHashes: [] },
    };
    const baseline = new MeshRelayEngine({ lruCapacity: 8 }).evaluateForward(envelope, relayHash);
    expect(baseline.dropReason).toBe('MAX_HOPS');

    const mutated = createMeshRelayEngineForTesting({ lruCapacity: 8, skipMaxHopsCheck: true }).evaluateForward(
      envelope,
      relayHash
    );
    expect(mutated.decision).toBe('FORWARD');
  });
});
