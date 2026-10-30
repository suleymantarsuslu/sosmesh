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
  type MeshTraceTimelineEntry,
  type MeshTraceReport,
} from './trace-export';

export interface RelayHopEnvelope {
  messageId: string;
  hopCount: number;
  ttl: number;
  /** Opaque ciphertext blob — relay MUST NOT decrypt. */
  ciphertextBase64: string;
}

export interface RelayObservation {
  node: 'B';
  sawPlaintextMarkers: string[];
  envelopeMeta: Pick<RelayHopEnvelope, 'messageId' | 'hopCount' | 'ttl'>;
}

export interface MultiHopResult {
  report: MeshTraceReport;
  delivered: boolean;
  relayObservation: RelayObservation;
  finalPayload: Buffer | null;
}

function wrapForRelay(ciphertext: Buffer, messageId: string, hopCount: number, ttl: number): Buffer {
  const wrapped: RelayHopEnvelope = {
    messageId,
    hopCount,
    ttl,
    ciphertextBase64: ciphertext.toString('base64'),
  };
  return Buffer.from(JSON.stringify(wrapped), 'utf-8');
}

function parseRelayWrapper(buf: Buffer): RelayHopEnvelope {
  return JSON.parse(buf.toString('utf-8')) as RelayHopEnvelope;
}

async function runSingleHop(
  seed: number,
  hopLabel: string,
  payload: Buffer,
  channel: ChaosChannelConfig,
  transferConfig: Partial<TransferConfig>,
  timeline: MeshTraceTimelineEntry[],
  clock: SimulatedClock
): Promise<{ ok: boolean; output: Buffer | null }> {
  const rng = new SeededRNG(seed);
  const { senderTransport, receiverTransport, channel: ch } = createChaosTransportPair(
    channel,
    rng,
    clock
  );

  const sender = new Sender(senderTransport, transferConfig, clock, rng);
  const receiver = new Receiver(receiverTransport, transferConfig, clock);

  let out: Buffer | null = null;
  sender.on('event', (e) => timeline.push({ t: e.timestamp, node: `${hopLabel}-sender`, kind: e.event }));
  receiver.on('event', (e) => timeline.push({ t: e.timestamp, node: `${hopLabel}-receiver`, kind: e.event }));
  receiver.on('completed', ({ payload: p }: { payload: Buffer }) => {
    out = p;
  });

  await sender.startTransfer(payload, hopLabel);
  const start = clock.now();
  while (clock.now() - start < 250000) {
    await clock.advanceAsync(10);
    ch.deliverPackets();
    const s = sender.getState();
    const r = receiver.getState();
    if (s === TransferState.COMPLETED && r === TransferState.COMPLETED) {
      return { ok: true, output: out };
    }
    if (s === TransferState.FAILED || r === TransferState.FAILED) {
      return { ok: false, output: null };
    }
    if (ch.getQueueSize() === 0 && !clock.hasPendingTimers()) {
      await clock.advanceAsync(100);
      if (sender.getState() === TransferState.COMPLETED && receiver.getState() === TransferState.COMPLETED) {
        return { ok: true, output: out };
      }
      break;
    }
  }
  return { ok: false, output: null };
}

export interface MultiHopOptions {
  seed: number;
  initialTtl: number;
  fixture?: LabFixtureCase;
  /** When true, skip TTL decrement (mutation testing hook). */
  skipTtlDecrement?: boolean;
}

const PLAINText_MARKERS = ['مرحبا', 'İstanbul', '🚨', 'ÇŞĞÜÖİ', 'SENTETIK_YARDIM'];

export async function runMultiHopRelay(options: MultiHopOptions): Promise<MultiHopResult> {
  const clock = new SimulatedClock();
  const timeline: MeshTraceTimelineEntry[] = [];
  const fixture = options.fixture ?? LAB_FIXTURES[1];
  const innerCiphertext = buildBlePayloadFromFixture(fixture);

  const messageId = `mesh-${options.seed}`;
  const hop0 = wrapForRelay(innerCiphertext, messageId, 0, options.initialTtl);

  const lowLoss: ChaosChannelConfig = {
    packetLoss: 0.02,
    duplicateRate: 0,
    reorderRate: 0.02,
    minLatency: 5,
    maxLatency: 15,
    partialWriteRate: 0,
  };

  const hopA = await runSingleHop(
    options.seed + 1,
    'A-B',
    hop0,
    lowLoss,
    { maxRetries: 10, mtu: 247 },
    timeline,
    clock
  );

  const relayObservation: RelayObservation = {
    node: 'B',
    sawPlaintextMarkers: [],
    envelopeMeta: { messageId, hopCount: 0, ttl: options.initialTtl },
  };

  if (!hopA.ok || hopA.output === null) {
    const report = buildTraceReport({
      seed: options.seed,
      scenario: 'multi-hop-A-B',
      mtu: 247,
      channel: {
        packetLoss: lowLoss.packetLoss,
        duplicateRate: 0,
        reorderRate: lowLoss.reorderRate,
        partialWriteRate: 0,
        minLatencyMs: lowLoss.minLatency,
        maxLatencyMs: lowLoss.maxLatency,
      },
      outcome: 'FAILED',
      senderState: 'FAILED',
      receiverState: 'FAILED',
      maxRetriesObserved: 0,
      timeline,
    });
    return { report, delivered: false, relayObservation, finalPayload: null };
  }

  const wrappedAtB = parseRelayWrapper(hopA.output);
  const relayLogSnapshot = JSON.stringify({
    meta: {
      messageId: wrappedAtB.messageId,
      hopCount: wrappedAtB.hopCount,
      ttl: wrappedAtB.ttl,
    },
    ciphertextPrefix: wrappedAtB.ciphertextBase64.slice(0, 24),
  });
  for (const marker of PLAINText_MARKERS) {
    if (relayLogSnapshot.includes(marker)) {
      relayObservation.sawPlaintextMarkers.push(marker);
    }
  }
  relayObservation.envelopeMeta = {
    messageId: wrappedAtB.messageId,
    hopCount: wrappedAtB.hopCount,
    ttl: wrappedAtB.ttl,
  };

  timeline.push({
    t: clock.now(),
    node: 'B-relay',
    kind: 'relay_store_opaque',
    errorClass: MeshTraceErrorClass.RELAY_OPAQUE_ONLY,
  });

  let nextTtl = wrappedAtB.ttl - 1;
  if (options.skipTtlDecrement) {
    nextTtl = wrappedAtB.ttl;
  }
  const nextHop = wrappedAtB.hopCount + 1;

  if (nextTtl < 0) {
    timeline.push({
      t: clock.now(),
      node: 'B-relay',
      kind: 'ttl_drop',
      errorClass: MeshTraceErrorClass.TTL_EXCEEDED,
    });
    const report = buildTraceReport({
      seed: options.seed,
      scenario: 'multi-hop-ttl-drop',
      mtu: 247,
      channel: {
        packetLoss: lowLoss.packetLoss,
        duplicateRate: 0,
        reorderRate: 0,
        partialWriteRate: 0,
        minLatencyMs: 5,
        maxLatencyMs: 15,
      },
      outcome: 'DROPPED',
      senderState: 'IDLE',
      receiverState: 'IDLE',
      maxRetriesObserved: 0,
      timeline,
    });
    return { report, delivered: false, relayObservation, finalPayload: null };
  }

  const forwardPayload = wrapForRelay(
    Buffer.from(wrappedAtB.ciphertextBase64, 'base64'),
    wrappedAtB.messageId,
    nextHop,
    nextTtl
  );

  const hopB = await runSingleHop(
    options.seed + 2,
    'B-C',
    forwardPayload,
    lowLoss,
    { maxRetries: 10, mtu: 247 },
    timeline,
    clock
  );

  let delivered = false;
  let finalPayload: Buffer | null = null;
  if (hopB.ok && hopB.output !== null) {
    const atC = parseRelayWrapper(hopB.output);
    if (atC.ttl >= 0 && atC.hopCount <= options.initialTtl) {
      finalPayload = Buffer.from(atC.ciphertextBase64, 'base64');
      delivered = finalPayload.equals(innerCiphertext);
    }
  }

  const report = buildTraceReport({
    seed: options.seed,
    scenario: 'multi-hop-A-B-C',
    mtu: 247,
    channel: {
      packetLoss: lowLoss.packetLoss,
      duplicateRate: 0,
      reorderRate: lowLoss.reorderRate,
      partialWriteRate: 0,
      minLatencyMs: 5,
      maxLatencyMs: 15,
    },
    outcome: delivered ? 'COMPLETED' : 'FAILED',
    senderState: delivered ? 'COMPLETED' : 'FAILED',
    receiverState: delivered ? 'COMPLETED' : 'FAILED',
    maxRetriesObserved: 0,
    timeline,
  });

  return { report, delivered, relayObservation, finalPayload };
}

export async function runTtlExceededScenario(seed: number): Promise<MultiHopResult> {
  return runMultiHopRelay({ seed, initialTtl: 0 });
}
