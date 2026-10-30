import { describe, it, expect } from 'vitest';
import {
  DeliveryStateMachine,
  InvalidStateTransitionError,
  loadStateTransitionsFixture,
} from '../src';

describe('DeliveryStateMachine from shared fixture', () => {
  const machine = new DeliveryStateMachine();
  const fixture = loadStateTransitionsFixture();

  it('loads fixture version 1 with five progress states', () => {
    expect(fixture.version).toBe(1);
    expect(fixture.progressOrder).toHaveLength(5);
    expect(fixture.progressOrder[0]).toBe('LOCAL_SAVED');
    expect(fixture.progressOrder[4]).toBe('CASE_IN_PROGRESS');
  });

  it('allows full forward chain LOCAL_SAVED through CASE_IN_PROGRESS', () => {
    let state = fixture.progressOrder[0];
    for (let i = 1; i < fixture.progressOrder.length; i += 1) {
      const next = fixture.progressOrder[i];
      expect(machine.canTransition(state, next)).toBe(true);
      state = machine.transition(state, next);
    }
    expect(state).toBe('CASE_IN_PROGRESS');
  });

  it('rejects invalid transition PEER_RECEIVED to OPERATOR_SEEN (negative)', () => {
    expect(machine.canTransition('PEER_RECEIVED', 'OPERATOR_SEEN')).toBe(false);
    expect(() => machine.transition('PEER_RECEIVED', 'OPERATOR_SEEN')).toThrow(
      InvalidStateTransitionError
    );
  });

  it('rejects backward transition SERVER_ACCEPTED to PEER_RECEIVED (negative)', () => {
    expect(machine.canTransition('SERVER_ACCEPTED', 'PEER_RECEIVED')).toBe(false);
  });

  it('PEER_RECEIVED does not imply SERVER_ACCEPTED', () => {
    const afterPeer = machine.transition('LOCAL_SAVED', 'PEER_RECEIVED');
    expect(afterPeer).toBe('PEER_RECEIVED');
    expect(afterPeer).not.toBe('SERVER_ACCEPTED');
  });

  it('allows terminal FAILED from LOCAL_SAVED', () => {
    expect(machine.transition('LOCAL_SAVED', 'FAILED')).toBe('FAILED');
    expect(machine.isTerminal('FAILED')).toBe(true);
  });
});
