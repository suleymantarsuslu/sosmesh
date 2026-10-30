import * as fs from 'node:fs';
import * as path from 'node:path';

export function repoRootFromPackage(): string {
  return path.resolve(__dirname, '../../..');
}

export function loadStateTransitionsFixture(): StateTransitionsFixture {
  const fixturePath = path.join(
    repoRootFromPackage(),
    'packages/fixtures/transport/state-transitions.json'
  );
  const raw = fs.readFileSync(fixturePath, 'utf8');
  return JSON.parse(raw) as StateTransitionsFixture;
}

export interface StateTransitionsFixture {
  version: number;
  progressOrder: TransportState[];
  terminalStates: TransportState[];
  validTransitions: Array<{ from: TransportState; to: TransportState }>;
  uxTimelineKeys: Record<string, string>;
  defaultRetentionMs: number;
}

export type ProgressState =
  | 'LOCAL_SAVED'
  | 'PEER_RECEIVED'
  | 'SERVER_ACCEPTED'
  | 'OPERATOR_SEEN'
  | 'CASE_IN_PROGRESS';

export type TerminalState = 'FAILED' | 'EXPIRED';

export type TransportState = ProgressState | TerminalState;
