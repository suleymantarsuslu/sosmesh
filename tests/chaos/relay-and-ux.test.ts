import { readFileSync } from 'fs';
import { join } from 'path';

import {
  LAB_FIXTURES,
  runMultiHopRelay,
  runTtlExceededScenario,
  simulateLowBatteryPause,
} from '@sosmesh/mesh-simulator';
import { describe, expect, it } from 'vitest';


describe('chaos_mesh_relay_privacy_and_ttl', () => {
  it('chaos_multi_hop_relay_B_never_sees_plaintext_markers', async () => {
    const result = await runMultiHopRelay({ seed: 500, initialTtl: 2 });
    expect(result.relayObservation.sawPlaintextMarkers).toEqual([]);
    expect(result.report.environment).toBe('simulated');
    expect(result.delivered).toBe(true);
    expect(result.finalPayload).not.toBeNull();
  });

  it('chaos_negative_ttl_exceeded_drops_before_final_delivery', async () => {
    const result = await runTtlExceededScenario(501);
    expect(result.delivered).toBe(false);
    expect(result.report.outcome).toBe('DROPPED');
    expect(result.report.errorClasses).toContain('TTL_EXCEEDED');
    expect(result.report.environment).toBe('simulated');
  });
});

describe('chaos_mesh_outbox_low_battery_pause', () => {
  it('chaos_low_battery_pause_blocks_outbox_until_resumed', () => {
    const timeline: Parameters<typeof simulateLowBatteryPause>[0] = [];
    const { pausedAttempts, resumedAttempts } = simulateLowBatteryPause(timeline, 0);
    expect(pausedAttempts).toBe(0);
    expect(resumedAttempts).toBe(1);
    expect(timeline.some((e) => e.kind === 'low_battery_pause')).toBe(true);
  });
});

describe('chaos_ux_simulated_not_real_device_copy', () => {
  it('chaos_lab_matrix_marks_real_device_column_not_tested', () => {
    const matrixPath = join(__dirname, '..', '..', 'docs/tests/lab-matrix.md');
    const content = readFileSync(matrixPath, 'utf-8');
    expect(content).toContain('NOT_TESTED');
    expect(content).toContain('environment: "simulated"');
  });

  it('chaos_web_home_does_not_claim_real_ble_verified', () => {
    const pagePath = join(__dirname, '..', '..', 'apps/web/app/page.tsx');
    const content = readFileSync(pagePath, 'utf-8').toLowerCase();
    expect(content).not.toContain('gerçek cihazda doğrulandı');
    expect(content).not.toContain('verified on real device');
  });
});

describe('chaos_mesh_unicode_fixture_case', () => {
  it('chaos_unicode_multilingual_fixture_transfer_strict_success', async () => {
    const { runSimulatedTransfer } = await import('@sosmesh/mesh-simulator');
    const result = await runSimulatedTransfer({
      seed: 8800,
      scenario: 'unicode',
      channel: {
        packetLoss: 0.05,
        duplicateRate: 0.02,
        reorderRate: 0.02,
        minLatency: 3,
        maxLatency: 12,
        partialWriteRate: 0,
      },
      fixture: LAB_FIXTURES[1],
      transferConfig: { maxRetries: 14, mtu: 247 },
    });
    expect(result.report.outcome).toBe('COMPLETED');
    expect(result.received).not.toBeNull();
    expect(result.report.environment).toBe('simulated');
  });
});
