import * as fs from 'fs';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

import {
  MeshRelayEngine,
  type MeshRelayEnvelopeV2,
  buildDedupKey,
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

    const mutated = new MeshRelayEngine({ lruCapacity: 8, skipTtlDecrement: true }).evaluateForward(
      envelope,
      relayHash
    );
    expect(mutated.decision).toBe('FORWARD');
  });
});
