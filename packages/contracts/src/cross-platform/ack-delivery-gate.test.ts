import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

import {
  evaluateDeliveryStateGate,
  evaluateTransferAckGate,
  peerReceivedIfIgnoringVerified,
} from './ack-delivery-gate';

const fixturePath = join(
  __dirname,
  '../../../fixtures/cross-platform/transfer-ack-gate.json'
);

describe('cross_platform_transfer_ack_gate_fixture', () => {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
    cases: Array<{
      id: string;
      input: Record<string, unknown>;
      expect: Record<string, unknown>;
    }>;
  };

  for (const testCase of fixture.cases) {
    it(`fixture_${testCase.id}`, () => {
      const input = testCase.input;
      const expected = testCase.expect;

      if ('crcValid' in input) {
        const result = evaluateTransferAckGate({
          crcValid: input.crcValid as boolean,
          digestValid: input.digestValid as boolean,
          chunkAcksComplete: input.chunkAcksComplete as boolean,
          transferVerified: input.transferVerified as boolean,
        });
        expect(result.mayEmitPeerReceived).toBe(expected.mayEmitPeerReceived);
        expect(result.mayEmitServerAccepted).toBe(expected.mayEmitServerAccepted);
        if (expected.rejectReason !== undefined) {
          expect(result.rejectReason).toBe(expected.rejectReason);
        }
      }

      if ('deliveryState' in input) {
        const stateResult = evaluateDeliveryStateGate({
          deliveryState: input.deliveryState as string,
        });
        if (expected.mayEmitPeerReceived !== undefined) {
          expect(stateResult.mayEmitPeerReceived).toBe(expected.mayEmitPeerReceived);
        }
        if (expected.mayEmitServerAccepted !== undefined) {
          expect(stateResult.mayEmitServerAccepted).toBe(expected.mayEmitServerAccepted);
        }
        if (expected.allowedNextStates) {
          expect(stateResult.allowedNextStates).toEqual(expected.allowedNextStates);
        }
        if (expected.forbiddenNextStates) {
          for (const forbidden of expected.forbiddenNextStates as string[]) {
            expect(stateResult.forbiddenNextStates).toContain(forbidden);
          }
        }
      }
    });
  }

  it('mutation_chunk_ack_only_differs_from_production_gate', () => {
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
