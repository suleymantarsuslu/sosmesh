import { readFileSync } from 'fs';
import { join } from 'path';


import { TransferState } from '@sosmesh/ble-protocol';
import {
  DEFAULT_CHAOS_30PCT,
  HUNDRED_TRANSFER_COUNT,
  HUNDRED_TRANSFER_EXPECTED_FAILED,
  HUNDRED_TRANSFER_EXPECTED_SUCCESS,
  LAB_FIXTURES,
  runHundredTransferBatch,
  runSimulatedTransfer,
  SeededRNG,
} from '@sosmesh/mesh-simulator';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');
const SCHEMA_PATH = join(
  REPO_ROOT,
  'tools/mesh-simulator/schemas/mesh-trace-v1.schema.json'
);
const GOLDEN_PATH = join(
  REPO_ROOT,
  'tools/mesh-simulator/golden/example-trace-seed4242.json'
);

describe('chaos_mesh_simulator_environment_field', () => {
  it('chaos_trace_report_requires_environment_simulated', async () => {
    const result = await runSimulatedTransfer({
      seed: 10000,
      scenario: 'env-field',
      channel: {
        packetLoss: 0,
        duplicateRate: 0,
        reorderRate: 0,
        minLatency: 1,
        maxLatency: 3,
        partialWriteRate: 0,
      },
    });
    expect(result.report.environment).toBe('simulated');
    const parsed = JSON.parse(result.reportJson) as { environment: string };
    expect(parsed.environment).toBe('simulated');
  });
});

describe('chaos_mesh_simulator_trace_schema_golden', () => {
  it('chaos_golden_trace_matches_schema_and_fixture_file', () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);

    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8'));
    expect(validate(golden)).toBe(true);
    expect(golden.environment).toBe('simulated');
    expect(golden.outcome).toBe('COMPLETED');
  });
});

describe('chaos_mesh_simulator_deterministic_trace_bytes', () => {
  it('chaos_same_seed_produces_byte_identical_trace_json', async () => {
    const opts = {
      seed: 9001,
      scenario: 'determinism',
      channel: DEFAULT_CHAOS_30PCT,
      transferConfig: { maxRetries: 10, mtu: 247 },
    };
    const a = await runSimulatedTransfer(opts);
    const b = await runSimulatedTransfer(opts);
    expect(a.reportJson).toBe(b.reportJson);
    expect(Buffer.byteLength(a.reportJson)).toBeGreaterThan(100);
  });
});

describe('chaos_mesh_simulator_hundred_transfer_batch', () => {
  it('chaos_hundred_sequential_fixture_transfers_exact_success_failed_counts', async () => {
    const { success, failed } = await runHundredTransferBatch();
    expect(success).toBe(HUNDRED_TRANSFER_EXPECTED_SUCCESS);
    expect(failed).toBe(HUNDRED_TRANSFER_EXPECTED_FAILED);
    expect(success + failed).toBe(HUNDRED_TRANSFER_COUNT);
  }, 120_000);
});

describe('chaos_mesh_simulator_mtu23_and_chaos30', () => {
  it('chaos_mtu23_scenario_never_reports_verified_success_without_receiver_completed', async () => {
    const result = await runSimulatedTransfer({
      seed: 42,
      scenario: 'mtu-23-lab',
      channel: {
        packetLoss: 0,
        duplicateRate: 0,
        reorderRate: 0,
        minLatency: 2,
        maxLatency: 6,
        partialWriteRate: 0,
      },
      transferConfig: { mtu: 23, maxRetries: 20, chunkTimeout: 1500 },
      maxSimTime: 1_000_000,
    });
    expect(result.report.environment).toBe('simulated');
    if (result.report.outcome === 'COMPLETED') {
      expect(result.received).not.toBeNull();
      expect(result.report.receiverState).toBe(TransferState.COMPLETED);
    } else {
      expect(result.report.receiverState).not.toBe(TransferState.COMPLETED);
    }
  });

  it('chaos_thirty_percent_loss_profile_does_not_crash', async () => {
    const result = await runSimulatedTransfer({
      seed: 3030,
      scenario: 'loss-30',
      channel: DEFAULT_CHAOS_30PCT,
      transferConfig: { maxRetries: 15, chunkTimeout: 900 },
      fixture: LAB_FIXTURES[1],
    });
    expect(result.report.environment).toBe('simulated');
    expect(['COMPLETED', 'FAILED', 'DROPPED']).toContain(result.report.outcome);
    if (result.report.outcome !== 'COMPLETED') {
      expect(result.received).toBeNull();
    }
  });
});

describe('chaos_mesh_simulator_negative_corrupt_packet', () => {
  it('chaos_negative_corrupt_injection_never_marks_completed', async () => {
    const result = await runSimulatedTransfer({
      seed: 777,
      scenario: 'corrupt-inject',
      channel: {
        packetLoss: 0,
        duplicateRate: 0,
        reorderRate: 0,
        minLatency: 2,
        maxLatency: 4,
        partialWriteRate: 0,
        partialCorruptRate: 1,
      },
    });
    expect(result.report.outcome).not.toBe('COMPLETED');
    expect(result.received).toBeNull();
    expect(result.report.environment).toBe('simulated');
  });
});

describe('chaos_mesh_simulator_mandatory_digest_reject', () => {
  it('chaos_mandatory_digest_invalid_never_completed', async () => {
    const {
      calculateCRC32,
      createMockTransportPair,
      Receiver,
      Sender,
      serializeChunk,
      SimulatedClock,
      splitIntoChunks,
    } = await import('@sosmesh/ble-protocol');

    const clock = new SimulatedClock();
    const rng = new SeededRNG(9999);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair(
      {
        packetLoss: 0,
        duplicateRate: 0,
        reorderRate: 0,
        minLatency: 5,
        maxLatency: 10,
      },
      rng,
      clock
    );

    const receiver = new Receiver(receiverTransport, {}, clock);
    const sender = new Sender(senderTransport, {}, clock, rng);

    let completedCount = 0;
    receiver.on('completed', () => {
      completedCount += 1;
    });

    const originalPayload = Buffer.from('ORIGINAL_DATA_CHAOS_LAB');
    await sender.startTransfer(originalPayload, 'digest_attack_chaos');

    await clock.advanceAsync(50);
    channel.deliverPackets();
    await clock.advanceAsync(50);
    channel.deliverPackets();

    const chunks = splitIntoChunks(originalPayload, 50);
    for (let i = 0; i < chunks.length - 1; i++) {
      receiverTransport.emit('data', serializeChunk(chunks[i]));
      await clock.advanceAsync(20);
      channel.deliverPackets();
    }

    const lastChunk = chunks[chunks.length - 1];
    const corruptedPayload = Buffer.concat([
      lastChunk.payload.slice(0, -32),
      Buffer.alloc(32, 0xff),
    ]);
    const corruptedChunk = {
      header: {
        ...lastChunk.header,
        crc32: calculateCRC32(corruptedPayload),
      },
      payload: corruptedPayload,
    };
    receiverTransport.emit('data', serializeChunk(corruptedChunk));
    await clock.advanceAsync(200);
    channel.deliverPackets();

    expect(completedCount).toBe(0);
    expect(receiver.getState()).not.toBe(TransferState.COMPLETED);
  });
});
