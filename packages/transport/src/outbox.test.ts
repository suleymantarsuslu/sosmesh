import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { describe, it, expect, afterEach } from 'vitest';
import {
  SqliteOutboxQueue,
  OutboxEngine,
  SimulatedClock,
  DeliveryStateMachine,
  nextRetryAt,
  DEFAULT_BACKOFF_MS,
} from '../src';

function tempDb(): string {
  return path.join(
    os.tmpdir(),
    `sosmesh-outbox-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
}

function childCliPath(): string {
  return path.join(__dirname, '../dist/outbox-child-cli.js');
}

async function spawnEnqueueWaitAndSigkill(
  dbPath: string,
  sosId: string,
  digest: string,
  state?: string
): Promise<void> {
  const args = [childCliPath(), 'enqueue-wait', dbPath, sosId, digest];
  if (state) {
    args.push(state);
  }
  const child = spawn(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const rl = createInterface({ input: child.stdout! });
  const readyLine = new Promise<string>((resolve, reject) => {
    rl.on('line', (line) => resolve(line));
    child.on('error', reject);
  });
  const line = await readyLine;
  expect(line).toBe('ready');
  child.kill('SIGKILL');
  const [code, signal] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
  expect(code).toBeNull();
  expect(signal).toBe('SIGKILL');
  rl.close();
}

describe('SqliteOutboxQueue persistence', () => {
  let dbPath: string;

  afterEach(() => {
    if (dbPath && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('duplicate insertion same sos id and digest yields single record', () => {
    dbPath = tempDb();
    const queue = new SqliteOutboxQueue(dbPath);
    const input = {
      sosId: 'id-dedup',
      digest: 'sha256-deadbeef',
      origin: 'device-a',
      encryptedBlobBase64: Buffer.from('ciphertext-only').toString('base64'),
    };
    const first = queue.enqueue(input, 1000);
    const second = queue.enqueue(input, 2000);
    expect(second.sosId).toBe(first.sosId);
    expect(queue.listAll()).toHaveLength(1);
    queue.close();
  });

  it('reboot simulation reopens queue with same rows', () => {
    dbPath = tempDb();
    const q1 = new SqliteOutboxQueue(dbPath);
    q1.enqueue(
      {
        sosId: 'reboot-1',
        digest: 'd1',
        origin: 'local',
        encryptedBlobBase64: 'YQ==',
      },
      500
    );
    q1.close();
    const q2 = new SqliteOutboxQueue(dbPath);
    expect(q2.listAll()).toHaveLength(1);
    expect(q2.getBySosId('reboot-1')?.state).toBe('LOCAL_SAVED');
    q2.close();
  });

  it('purgeExpired removes encrypted blob after retention', () => {
    dbPath = tempDb();
    const queue = new SqliteOutboxQueue(dbPath, 1000);
    queue.enqueue(
      {
        sosId: 'retention-1',
        digest: 'd',
        origin: 'local',
        encryptedBlobBase64: 'YQ==',
        retentionMs: 1000,
      },
      0
    );
    expect(queue.purgeExpired(1001)).toBe(1);
    expect(queue.listAll()).toHaveLength(0);
    queue.close();
  });

  it('clock skew: retry_at respected after simulated clock jump backward and forward', () => {
    dbPath = tempDb();
    const clock = new SimulatedClock(10_000);
    const engine = new OutboxEngine({
      queue: new SqliteOutboxQueue(dbPath),
      clock,
    });
    engine.saveLocal({
      sosId: 'skew-1',
      digest: 'd',
      origin: 'local',
      encryptedBlobBase64: 'YQ==',
    });
    engine.recordSendFailure('skew-1', 'offline', 1);
    clock.advance(-5000);
    expect(engine.countSendAttemptsDue()).toBe(0);
    clock.set(80_000);
    expect(engine.countSendAttemptsDue()).toBe(1);
  });

  it('offline retry backoff boundaries and retention purge at expires_at', () => {
    dbPath = tempDb();
    const startMs = 1_000;
    const retentionMs = 86_400_000;
    const clock = new SimulatedClock(startMs);
    const queue = new SqliteOutboxQueue(dbPath, retentionMs);
    const engine = new OutboxEngine({ queue, clock });
    engine.saveLocal({
      sosId: 'offline-day',
      digest: 'd-offline',
      origin: 'local',
      encryptedBlobBase64: 'YQ==',
      retentionMs,
    });
    let row = queue.getByKey('offline-day', 'd-offline')!;
    expect(row.retryAtMs).toBe(startMs);
    expect(row.expiresAtMs).toBe(startMs + retentionMs);

    engine.recordSendFailure('offline-day', 'network-a', 1);
    row = queue.getByKey('offline-day', 'd-offline')!;
    expect(row.retryAtMs).toBe(nextRetryAt(startMs, 1));
    expect(row.retryAtMs).toBe(startMs + DEFAULT_BACKOFF_MS);
    expect(row.lastError).toBe('network-a');
    clock.set(startMs);
    expect(engine.countSendAttemptsDue()).toBe(0);

    clock.set(row.retryAtMs - 1);
    expect(engine.countSendAttemptsDue()).toBe(0);
    clock.set(row.retryAtMs);
    expect(engine.countSendAttemptsDue()).toBe(1);

    clock.set(62_000);
    engine.recordSendFailure('offline-day', 'network-b', 2);
    row = queue.getByKey('offline-day', 'd-offline')!;
    expect(row.retryAtMs).toBe(nextRetryAt(62_000, 2));
    expect(row.retryAtMs).toBe(62_000 + DEFAULT_BACKOFF_MS * 2);
    expect(row.lastError).toBe('network-b');

    const expiresAt = row.expiresAtMs;
    expect(queue.purgeExpired(expiresAt - 1)).toBe(0);
    expect(queue.listAll()).toHaveLength(1);
    expect(queue.purgeExpired(expiresAt)).toBe(1);
    expect(queue.listAll()).toHaveLength(0);
    queue.close();
  });

  it('pause while permission or battery blocked yields zero send attempts', () => {
    dbPath = tempDb();
    const clock = new SimulatedClock(100);
    const engine = new OutboxEngine({
      queue: new SqliteOutboxQueue(dbPath),
      clock,
    });
    engine.saveLocal({
      sosId: 'pause-1',
      digest: 'd',
      origin: 'local',
      encryptedBlobBase64: 'YQ==',
    });
    engine.setPaused(true);
    expect(engine.countSendAttemptsDue()).toBe(0);
    engine.setPaused(false);
    expect(engine.countSendAttemptsDue()).toBe(1);
  });

  it('SIGKILL after enqueue-wait preserves LOCAL_SAVED row on disk', async () => {
    dbPath = tempDb();
    const sosId = 'sigkill-local';
    const digest = 'digest-kill-1';
    await spawnEnqueueWaitAndSigkill(dbPath, sosId, digest);
    const queue = new SqliteOutboxQueue(dbPath);
    expect(queue.listAll()).toHaveLength(1);
    const row = queue.getByKey(sosId, digest);
    expect(row?.sosId).toBe(sosId);
    expect(row?.digest).toBe(digest);
    expect(row?.state).toBe('LOCAL_SAVED');
    queue.close();
  });

  it('SIGKILL after PEER_RECEIVED preserves delivery state on disk', async () => {
    dbPath = tempDb();
    const sosId = 'sigkill-peer';
    const digest = 'digest-peer';
    await spawnEnqueueWaitAndSigkill(dbPath, sosId, digest, 'PEER_RECEIVED');
    const queue = new SqliteOutboxQueue(dbPath);
    const row = queue.getByKey(sosId, digest);
    expect(row?.state).toBe('PEER_RECEIVED');
    queue.close();
  });

  it('state advance uses shared machine PEER then SERVER distinct', () => {
    dbPath = tempDb();
    const clock = new SimulatedClock(1);
    const queue = new SqliteOutboxQueue(dbPath);
    const engine = new OutboxEngine({
      queue,
      clock,
      stateMachine: new DeliveryStateMachine(),
    });
    engine.saveLocal({
      sosId: 'hop-1',
      digest: 'd',
      origin: 'local',
      encryptedBlobBase64: 'YQ==',
    });
    engine.advanceState('hop-1', 'PEER_RECEIVED');
    const peer = queue.getBySosId('hop-1');
    expect(peer?.state).toBe('PEER_RECEIVED');
    engine.advanceState('hop-1', 'SERVER_ACCEPTED');
    const server = queue.getBySosId('hop-1');
    expect(server?.state).toBe('SERVER_ACCEPTED');
    queue.close();
  });
});
