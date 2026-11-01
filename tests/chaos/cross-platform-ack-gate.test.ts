import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

import {
  evaluateTransferAckGate,
  peerReceivedIfIgnoringVerified,
} from '@sosmesh/contracts';

describe('chaos_cross_platform_ack_gate_fixture', () => {
  it('chaos_fixture_rejects_chunk_ack_without_verified', () => {
    const fixturePath = join(
      __dirname,
      '..',
      '..',
      'packages/fixtures/cross-platform/transfer-ack-gate.json'
    );
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      cases: Array<{ id: string; input: Record<string, unknown>; expect: Record<string, unknown> }>;
    };
    const caseRow = fixture.cases.find((c) => c.id === 'chunk_ack_without_verified_no_peer');
    expect(caseRow).toBeDefined();
    const input = caseRow!.input;
    const result = evaluateTransferAckGate({
      crcValid: input.crcValid as boolean,
      digestValid: input.digestValid as boolean,
      chunkAcksComplete: input.chunkAcksComplete as boolean,
      transferVerified: input.transferVerified as boolean,
    });
    expect(result.mayEmitPeerReceived).toBe(false);
    expect(result.mayEmitServerAccepted).toBe(false);
  });

  it('chaos_mutation_verified_gate_blocks_false_peer_received', () => {
    const input = {
      crcValid: true,
      digestValid: true,
      chunkAcksComplete: true,
      transferVerified: false,
    };
    expect(evaluateTransferAckGate(input).mayEmitPeerReceived).toBe(false);
    expect(peerReceivedIfIgnoringVerified(input)).toBe(true);
  });
});
