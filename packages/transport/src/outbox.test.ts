import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it, expect, afterEach } from 'vitest';
import {
  SqliteOutboxQueue,
  OutboxEngine,
  SimulatedClock,
  DeliveryStateMachine,
} from '../src';

function tempDb(): string {
  return path.join(
    os.tmpdir(),
    `sosmesh-outbox-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
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

  it('offline 24h simulated clock advances retry backoff and expires_at purge', () => {
    dbPath = tempDb();
    const clock = new SimulatedClock(0);
    const queue = new SqliteOutboxQueue(dbPath, 86_400_000);
    const engine = new OutboxEngine({ queue, clock });
    engine.saveLocal({
      sosId: 'offline-day',
      digest: 'd',
      origin: 'local',
      encryptedBlobBase64: 'YQ==',
      retentionMs: 86_400_000,
    });
    engine.recordSendFailure('offline-day', 'network', 1);
    clock.advance(86_400_000);
    expect(queue.purgeExpired(clock.nowMs())).toBe(1);
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

  it('process kill restart via subprocess preserves outbox on disk', () => {
    dbPath = tempDb();
    const childPath = path.join(__dirname, '../scripts/outbox-child.cjs');
    const enqueue = spawnSync(process.execPath, [childPath, 'enqueue', dbPath], {
      encoding: 'utf8',
    });
    expect(enqueue.status).toBe(0);
    const countAfterKill = spawnSync(process.execPath, [childPath, 'count', dbPath], {
      encoding: 'utf8',
    });
    expect(countAfterKill.status).toBe(0);
    expect(countAfterKill.stdout.trim()).toBe('1');
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
