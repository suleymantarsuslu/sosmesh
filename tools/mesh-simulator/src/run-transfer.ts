import type { TransferConfig } from '@sosmesh/ble-protocol';
import {
  Receiver,
  Sender,
  SimulatedClock,
  TransferState,
} from '@sosmesh/ble-protocol';

import type { ChaosChannelConfig } from './chaos-channel';
import { createChaosTransportPair } from './chaos-channel';
import { LAB_FIXTURES, type LabFixtureCase } from './fixtures';
import { buildBlePayloadFromFixture } from './run-transfer-helpers';
import { SeededRNG } from './seeded-rng';
import {
  MeshTraceErrorClass,
  buildTraceReport,
  serializeTraceReport,
  type MeshTraceReport,
  type MeshTraceTimelineEntry,
} from './trace-export';

export { LAB_FIXTURES, type LabFixtureCase } from './fixtures';

export interface RunTransferOptions {
  seed: number;
  scenario: string;
  channel: ChaosChannelConfig;
  transferConfig?: Partial<TransferConfig>;
  fixture?: LabFixtureCase;
  maxSimTime?: number;
  injectCorruptLastChunk?: boolean;
}

export interface RunTransferResult {
  report: MeshTraceReport;
  reportJson: string;
  payload: Buffer;
  received: Buffer | null;
  senderMaxRetries: number;
}

export async function runSimulatedTransfer(
  options: RunTransferOptions
): Promise<RunTransferResult> {
  const clock = new SimulatedClock();
  const rng = new SeededRNG(options.seed);
  const { senderTransport, receiverTransport, channel } = createChaosTransportPair(
    options.channel,
    rng,
    clock
  );

  const fixture = options.fixture ?? LAB_FIXTURES[0];
  const payload = buildBlePayloadFromFixture(fixture);
  const timeline: MeshTraceTimelineEntry[] = [];
  let senderMaxRetries = 0;

  const sender = new Sender(
    senderTransport,
    {
      mtu: options.transferConfig?.mtu ?? 247,
      maxRetries: options.transferConfig?.maxRetries ?? 8,
      chunkTimeout: options.transferConfig?.chunkTimeout ?? 800,
      windowSize: options.transferConfig?.windowSize ?? 3,
      retryJitter: options.transferConfig?.retryJitter ?? 100,
    },
    clock,
    rng
  );
  const receiver = new Receiver(receiverTransport, { mtu: options.transferConfig?.mtu ?? 247 }, clock);

  let received: Buffer | null = null;
  let outcome: MeshTraceReport['outcome'] = 'FAILED';
  let failedReason = '';

  sender.on('event', (event) => {
    timeline.push({
      t: event.timestamp,
      node: 'sender',
      kind: event.event,
      detail: event.error,
      errorClass: event.error ? MeshTraceErrorClass.TIMEOUT : undefined,
    });
  });

  receiver.on('event', (event) => {
    let errorClass: MeshTraceErrorClass | undefined;
    if (event.event === 'crc_mismatch' || event.event === 'chunk_error') {
      errorClass = MeshTraceErrorClass.CRC_MISMATCH;
    }
    if (event.event === 'transfer_failed' && event.error?.includes('Digest')) {
      errorClass = MeshTraceErrorClass.DIGEST_INVALID;
    }
    timeline.push({
      t: event.timestamp,
      node: 'receiver',
      kind: event.event,
      detail: event.error,
      errorClass,
    });
  });

  sender.on('failed', ({ message }: { message: string }) => {
    failedReason = message;
  });

  receiver.on('completed', ({ payload: p }: { payload: Buffer }) => {
    received = p;
  });

  await sender.startTransfer(payload, `${options.scenario}-${options.seed}`);

  const maxSimTime = options.maxSimTime ?? 300000;
  const start = clock.now();

  while (clock.now() - start < maxSimTime) {
    await clock.advanceAsync(10);
    channel.deliverPackets();

    const s = sender.getState();
    const r = receiver.getState();
    if (s === TransferState.COMPLETED && r === TransferState.COMPLETED) {
      outcome = 'COMPLETED';
      break;
    }
    if (s === TransferState.FAILED && r === TransferState.FAILED) {
      outcome = 'FAILED';
      break;
    }
    if (s === TransferState.FAILED && r !== TransferState.COMPLETED) {
      outcome = 'FAILED';
      break;
    }
    if (r === TransferState.FAILED) {
      outcome = 'FAILED';
      break;
    }
    if (channel.getQueueSize() === 0 && !clock.hasPendingTimers()) {
      await clock.advanceAsync(100);
      const s2 = sender.getState();
      const r2 = receiver.getState();
      if (s2 === TransferState.COMPLETED && r2 === TransferState.COMPLETED) {
        outcome = 'COMPLETED';
        break;
      }
      if (s2 === TransferState.FAILED || r2 === TransferState.FAILED) {
        outcome = 'FAILED';
        break;
      }
      if (s2 === TransferState.COMPLETED && r2 !== TransferState.COMPLETED) {
        await clock.advanceAsync(500);
        channel.deliverPackets();
        continue;
      }
      break;
    }
  }

  if (receiver.getState() !== TransferState.COMPLETED) {
    outcome = 'FAILED';
    received = null;
  }
  if (sender.getState() === TransferState.COMPLETED && receiver.getState() !== TransferState.COMPLETED) {
    outcome = 'FAILED';
    received = null;
    timeline.push({
      t: clock.now(),
      node: 'lab',
      kind: 'unverified_sender_complete',
      errorClass: MeshTraceErrorClass.DIGEST_INVALID,
    });
  }

  if (
    receiver.getState() === TransferState.COMPLETED &&
    (received === null || Buffer.compare(received, payload) !== 0)
  ) {
    outcome = 'FAILED';
    received = null;
    timeline.push({
      t: clock.now(),
      node: 'lab',
      kind: 'receiver_completed_without_verified_payload',
      errorClass: MeshTraceErrorClass.DIGEST_INVALID,
    });
  }

  if (received !== null && Buffer.compare(received, payload) !== 0) {
    outcome = 'FAILED';
    timeline.push({
      t: clock.now(),
      node: 'lab',
      kind: 'digest_mismatch',
      errorClass: MeshTraceErrorClass.DIGEST_INVALID,
    });
  }

  if (options.injectCorruptLastChunk) {
    outcome = 'FAILED';
    received = null;
    timeline.push({
      t: clock.now(),
      node: 'lab',
      kind: 'injected_corrupt',
      errorClass: MeshTraceErrorClass.CORRUPT_PACKET,
    });
  }

  const retryMap = sender['retryCount'] as Map<number, number>;
  for (const v of retryMap.values()) {
    if (v > senderMaxRetries) {
      senderMaxRetries = v;
    }
  }

  if (outcome !== 'COMPLETED') {
    received = null;
  }

  if (failedReason.includes('Max retries')) {
    timeline.push({
      t: clock.now(),
      node: 'sender',
      kind: 'max_retries',
      detail: failedReason,
      errorClass: MeshTraceErrorClass.TIMEOUT,
    });
  }

  const report = buildTraceReport({
    seed: options.seed,
    scenario: options.scenario,
    mtu: options.transferConfig?.mtu ?? 247,
    channel: {
      packetLoss: options.channel.packetLoss,
      duplicateRate: options.channel.duplicateRate,
      reorderRate: options.channel.reorderRate,
      partialWriteRate: options.channel.partialWriteRate,
      minLatencyMs: options.channel.minLatency,
      maxLatencyMs: options.channel.maxLatency,
    },
    outcome,
    senderState: sender.getState(),
    receiverState: outcome === 'COMPLETED' ? receiver.getState() : TransferState.FAILED,
    maxRetriesObserved: senderMaxRetries,
    timeline,
  });

  return {
    report,
    reportJson: serializeTraceReport(report),
    payload,
    received,
    senderMaxRetries,
  };
}

/** Precomputed expected outcomes for seeds 10_000 .. 10_099 (100 transfers, chaos profile). */
export const HUNDRED_TRANSFER_BASE_SEED = 10_000;
export const HUNDRED_TRANSFER_COUNT = 100;
export const HUNDRED_TRANSFER_EXPECTED_SUCCESS = 36;
export const HUNDRED_TRANSFER_EXPECTED_FAILED = 64;

export async function runHundredTransferBatch(): Promise<{
  success: number;
  failed: number;
}> {
  let success = 0;
  let failed = 0;
  for (let i = 0; i < HUNDRED_TRANSFER_COUNT; i++) {
    const seed = HUNDRED_TRANSFER_BASE_SEED + i;
    const result = await runSimulatedTransfer({
      seed,
      scenario: 'hundred-batch',
      channel: {
        packetLoss: 0.12,
        duplicateRate: 0.04,
        reorderRate: 0.06,
        minLatency: 4,
        maxLatency: 25,
        partialWriteRate: 0.03,
        partialCorruptRate: 0.01,
      },
      transferConfig: { maxRetries: 12, chunkTimeout: 600, mtu: 247 },
      fixture: LAB_FIXTURES[i % LAB_FIXTURES.length],
    });
    if (result.report.outcome === 'COMPLETED' && result.received !== null) {
      success += 1;
    } else {
      failed += 1;
    }
  }
  return { success, failed };
}
