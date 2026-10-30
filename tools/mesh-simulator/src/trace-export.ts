/** Error classes recorded in mesh lab traces (no PII). */
export enum MeshTraceErrorClass {
  CRC_MISMATCH = 'CRC_MISMATCH',
  DIGEST_INVALID = 'DIGEST_INVALID',
  TIMEOUT = 'TIMEOUT',
  TTL_EXCEEDED = 'TTL_EXCEEDED',
  CORRUPT_PACKET = 'CORRUPT_PACKET',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  OUTBOX_PAUSED = 'OUTBOX_PAUSED',
  RELAY_OPAQUE_ONLY = 'RELAY_OPAQUE_ONLY',
  GENERIC = 'GENERIC',
}

export interface MeshTraceTimelineEntry {
  t: number;
  node: string;
  kind: string;
  detail?: string;
  errorClass?: MeshTraceErrorClass;
}

export interface MeshTraceReport {
  environment: 'simulated';
  schemaVersion: 1;
  seed: number;
  scenario: string;
  mtu: number;
  channel: {
    packetLoss: number;
    duplicateRate: number;
    reorderRate: number;
    partialWriteRate: number;
    minLatencyMs: number;
    maxLatencyMs: number;
  };
  outcome: 'COMPLETED' | 'FAILED' | 'DROPPED';
  senderState: string;
  receiverState: string;
  maxRetriesObserved: number;
  timeline: MeshTraceTimelineEntry[];
  errorClasses: MeshTraceErrorClass[];
}

export function buildTraceReport(
  partial: Omit<
    MeshTraceReport,
    'environment' | 'schemaVersion' | 'errorClasses'
  >
): MeshTraceReport {
  const errorClasses = [
    ...new Set(
      partial.timeline
        .map((e) => e.errorClass)
        .filter((c): c is MeshTraceErrorClass => c !== undefined)
    ),
  ];
  return {
    environment: 'simulated',
    schemaVersion: 1,
    errorClasses,
    ...partial,
  };
}

export function serializeTraceReport(report: MeshTraceReport): string {
  return JSON.stringify(report, null, 0);
}
