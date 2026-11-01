import { execSync } from 'child_process';
import { join } from 'path';

import { describe, expect, it } from 'vitest';
import { DeliveryStateMachine, InvalidStateTransitionError } from '@sosmesh/transport';

describe('false_green_confidence_gates', () => {
  const repoRoot = join(__dirname, '..', '..');

  it('forbidden_copy_scan_still_passes', () => {
    const output = execSync('node scripts/ux-forbidden-copy.js', {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    expect(output).toContain('Yasak ifade bulunamadı');
  });

  it('shared_transport_state_chart_never_jumps_LOCAL_SAVED_to_SERVER_ACCEPTED', () => {
    const machine = new DeliveryStateMachine();
    expect(machine.canTransition('LOCAL_SAVED', 'SERVER_ACCEPTED')).toBe(false);
    expect(() => machine.transition('LOCAL_SAVED', 'SERVER_ACCEPTED')).toThrow(
      InvalidStateTransitionError
    );
    expect(machine.transition('LOCAL_SAVED', 'PEER_RECEIVED')).toBe('PEER_RECEIVED');
    expect(machine.transition('LOCAL_SAVED', 'PEER_RECEIVED')).not.toBe('SERVER_ACCEPTED');
  });
});
