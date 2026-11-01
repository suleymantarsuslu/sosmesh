export interface HopChainReceiptV2 {
  relayDeviceIdHashes: string[];
}

export interface MeshRelayEnvelopeV2 {
  protocolVersion: 2;
  messageId: string;
  hopCount: number;
  maxHops: number;
  ttlHops: number;
  copyCount: number;
  maxCopyCount: number;
  originCreatedAt: string;
  opaqueCiphertextBase64: string;
  hopChainReceipt: HopChainReceiptV2;
  peerAckHint?: 'PEER_RECEIVED_ONLY';
}

export type MeshRelayDropReason =
  | 'TTL_EXCEEDED'
  | 'MAX_HOPS'
  | 'DUPLICATE'
  | 'COPY_CAP'
  | 'LOOP_DETECTED'
  | 'INVALID_ENVELOPE';

export type MeshRelayDecision = 'FORWARD' | 'DROP';

export interface MeshRelayEngineOutcome {
  decision: MeshRelayDecision;
  dropReason?: MeshRelayDropReason;
  forward?: MeshRelayEnvelopeV2;
  dedupKey?: string;
}

export interface MeshRelayEngineConfig {
  lruCapacity: number;
}

/** @internal Runtime flags; production ctor always disables mutation skips. */
export interface MeshRelayEngineInternalRuntime {
  lruCapacity: number;
  skipTtlDecrement: boolean;
  skipDedupCheck: boolean;
  skipLoopGuard: boolean;
  skipMaxHopsCheck: boolean;
}

function productionRuntime(config: MeshRelayEngineConfig): MeshRelayEngineInternalRuntime {
  return {
    lruCapacity: config.lruCapacity,
    skipTtlDecrement: false,
    skipDedupCheck: false,
    skipLoopGuard: false,
    skipMaxHopsCheck: false,
  };
}

/** @internal Used by mesh-relay-engine.testing.ts only. */
export function meshRelayEngineFromInternalRuntime(
  runtime: MeshRelayEngineInternalRuntime
): MeshRelayEngine {
  const engine = Object.create(MeshRelayEngine.prototype) as MeshRelayEngine;
  Object.defineProperty(engine, 'config', { value: runtime });
  Object.defineProperty(engine, 'dedup', { value: new MeshRelayDedupStore(runtime.lruCapacity) });
  return engine;
}

const DEVICE_HASH = /^[a-f0-9]{64}$/;

export function buildDedupKey(envelope: MeshRelayEnvelopeV2): string {
  const prefix = envelope.opaqueCiphertextBase64.slice(0, 8);
  return `${envelope.messageId}:${envelope.hopCount}:${prefix}`;
}

export function relayLogSnapshot(envelope: MeshRelayEnvelopeV2): string {
  return JSON.stringify({
    messageId: envelope.messageId,
    hopCount: envelope.hopCount,
    ttlHops: envelope.ttlHops,
    ciphertextPrefix: envelope.opaqueCiphertextBase64.slice(0, 24),
  });
}

export class MeshRelayDedupStore {
  private readonly order: string[] = [];
  private readonly seen = new Set<string>();

  constructor(private readonly capacity: number) {}

  has(key: string): boolean {
    return this.seen.has(key);
  }

  remember(key: string): void {
    if (this.seen.has(key)) {
      return;
    }
    this.seen.add(key);
    this.order.push(key);
    while (this.order.length > this.capacity) {
      const evicted = this.order.shift();
      if (evicted) {
        this.seen.delete(evicted);
      }
    }
  }
}

function validateEnvelope(envelope: MeshRelayEnvelopeV2): boolean {
  if (envelope.protocolVersion !== 2) {
    return false;
  }
  if (envelope.hopCount < 0 || envelope.hopCount > envelope.maxHops) {
    return false;
  }
  if (envelope.ttlHops < 0) {
    return false;
  }
  if (envelope.copyCount < 1 || envelope.copyCount > envelope.maxCopyCount) {
    return false;
  }
  for (const hash of envelope.hopChainReceipt.relayDeviceIdHashes) {
    if (!DEVICE_HASH.test(hash)) {
      return false;
    }
  }
  return envelope.opaqueCiphertextBase64.length >= 4;
}

const MESH_RELAY_ENGINE_TESTING_BRAND = Symbol('meshRelayEngineTesting');
void MESH_RELAY_ENGINE_TESTING_BRAND;

export class MeshRelayEngine {
  private readonly config: MeshRelayEngineInternalRuntime;
  private readonly dedup: MeshRelayDedupStore;

  constructor(config: MeshRelayEngineConfig) {
    this.config = productionRuntime(config);
    this.dedup = new MeshRelayDedupStore(config.lruCapacity);
  }

  seedDedupKey(key: string): void {
    this.dedup.remember(key);
  }

  evaluateForward(
    envelope: MeshRelayEnvelopeV2,
    relayDeviceIdHash: string
  ): MeshRelayEngineOutcome {
    if (!validateEnvelope(envelope)) {
      return { decision: 'DROP', dropReason: 'INVALID_ENVELOPE' };
    }
    if (!DEVICE_HASH.test(relayDeviceIdHash)) {
      return { decision: 'DROP', dropReason: 'INVALID_ENVELOPE' };
    }

    const dedupKey = buildDedupKey(envelope);
    if (!this.config.skipDedupCheck && this.dedup.has(dedupKey)) {
      return { decision: 'DROP', dropReason: 'DUPLICATE', dedupKey };
    }

    if (
      !this.config.skipLoopGuard &&
      envelope.hopChainReceipt.relayDeviceIdHashes.includes(relayDeviceIdHash)
    ) {
      return { decision: 'DROP', dropReason: 'LOOP_DETECTED', dedupKey };
    }

    if (!this.config.skipMaxHopsCheck && envelope.hopCount >= envelope.maxHops) {
      return { decision: 'DROP', dropReason: 'MAX_HOPS', dedupKey };
    }

    if (envelope.copyCount >= envelope.maxCopyCount) {
      return { decision: 'DROP', dropReason: 'COPY_CAP', dedupKey };
    }

    let nextTtl = envelope.ttlHops - 1;
    if (this.config.skipTtlDecrement) {
      nextTtl = envelope.ttlHops;
    }
    if (nextTtl < 0) {
      return { decision: 'DROP', dropReason: 'TTL_EXCEEDED', dedupKey };
    }

    this.dedup.remember(dedupKey);

    const forward: MeshRelayEnvelopeV2 = {
      ...envelope,
      hopCount: envelope.hopCount + 1,
      ttlHops: nextTtl,
      copyCount: envelope.copyCount + 1,
      hopChainReceipt: {
        relayDeviceIdHashes: [
          ...envelope.hopChainReceipt.relayDeviceIdHashes,
          relayDeviceIdHash,
        ],
      },
      peerAckHint: 'PEER_RECEIVED_ONLY',
    };

    return { decision: 'FORWARD', forward, dedupKey };
  }
}

export function wrapOpaqueForBleTransfer(
  innerCiphertext: Buffer,
  messageId: string,
  initialTtlHops: number,
  maxHops = 5,
  maxCopyCount = 3
): Buffer {
  const envelope: MeshRelayEnvelopeV2 = {
    protocolVersion: 2,
    messageId,
    hopCount: 0,
    maxHops,
    ttlHops: initialTtlHops,
    copyCount: 1,
    maxCopyCount,
    originCreatedAt: new Date(0).toISOString().replace('.000Z', 'Z'),
    opaqueCiphertextBase64: innerCiphertext.toString('base64'),
    hopChainReceipt: { relayDeviceIdHashes: [] },
    peerAckHint: 'PEER_RECEIVED_ONLY',
  };
  return Buffer.from(JSON.stringify(envelope), 'utf-8');
}

export function parseMeshRelayEnvelope(buf: Buffer): MeshRelayEnvelopeV2 {
  return JSON.parse(buf.toString('utf-8')) as MeshRelayEnvelopeV2;
}

export function unwrapOpaqueCiphertext(envelope: MeshRelayEnvelopeV2): Buffer {
  return Buffer.from(envelope.opaqueCiphertextBase64, 'base64');
}
