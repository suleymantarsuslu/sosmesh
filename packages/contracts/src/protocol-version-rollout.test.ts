import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MeshRelayEngine } from './protocol-v2/mesh-relay-engine';
import type { MeshRelayEnvelopeV2 } from './protocol-v2/mesh-relay-engine';

const vectorsPath = join(
  __dirname,
  '..',
  'protocol-v2',
  'vectors',
  'relay-engine-cases.json'
);

function loadSampleEnvelope(): MeshRelayEnvelopeV2 {
  const parsed = JSON.parse(readFileSync(vectorsPath, 'utf8')) as {
    cases: { envelope: MeshRelayEnvelopeV2 }[];
  };
  return parsed.cases[0].envelope;
}

describe('protocol version rollout (mixed clients)', () => {
  const engine = new MeshRelayEngine({ lruCapacity: 128 });
  const relayId = 'a'.repeat(64);

  it('accepts v2 envelopes from current clients', () => {
    const envelope = loadSampleEnvelope();
    const outcome = engine.evaluateForward(envelope, relayId);
    expect(outcome.decision).toBe('FORWARD');
  });

  it('rejects legacy v1-shaped envelopes without forwarding', () => {
    const v2 = loadSampleEnvelope();
    const legacy = {
      ...v2,
      protocolVersion: 1 as unknown as 2,
    };
    const outcome = engine.evaluateForward(legacy, relayId);
    expect(outcome.decision).toBe('DROP');
    expect(outcome.dropReason).toBe('INVALID_ENVELOPE');
  });

  it('keeps v2 forwarding when v1 and v2 batches are interleaved', () => {
    const v2 = loadSampleEnvelope();
    const legacy = {
      ...v2,
      messageId: 'legacy-client-msg',
      protocolVersion: 1 as unknown as 2,
    };
    const mixed = [
      legacy,
      { ...v2, messageId: 'modern-client-msg-a' },
      legacy,
      { ...v2, messageId: 'modern-client-msg-b' },
    ];
    const decisions = mixed.map((item) => engine.evaluateForward(item, relayId));
    expect(decisions.map((d) => d.decision)).toEqual(['DROP', 'FORWARD', 'DROP', 'FORWARD']);
  });
});
