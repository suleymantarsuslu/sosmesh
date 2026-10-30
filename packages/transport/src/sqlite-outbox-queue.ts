import Database from 'better-sqlite3';
import { loadStateTransitionsFixture } from './fixture-path';
import type {
  EnqueueInput,
  OutboxEntryMeta,
  OutboxQueueAdapter,
} from './outbox-types';
import type { TransportState } from './fixture-path';

function rowToMeta(row: Record<string, unknown>): OutboxEntryMeta {
  return {
    sosId: row.sos_id as string,
    digest: row.digest as string,
    origin: row.origin as string,
    encryptedBlobBase64: row.encrypted_blob as string,
    state: row.state as TransportState,
    retryAtMs: row.retry_at as number,
    expiresAtMs: row.expires_at as number,
    lastError: (row.last_error as string | null) ?? null,
    createdAtMs: row.created_at as number,
    updatedAtMs: row.updated_at as number,
  };
}

export class SqliteOutboxQueue implements OutboxQueueAdapter {
  private readonly db: Database.Database;
  private readonly defaultRetentionMs: number;

  constructor(dbPath: string, retentionMs?: number) {
    this.defaultRetentionMs =
      retentionMs ?? loadStateTransitionsFixture().defaultRetentionMs;
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbox (
        sos_id TEXT NOT NULL,
        digest TEXT NOT NULL,
        origin TEXT NOT NULL,
        encrypted_blob TEXT NOT NULL,
        state TEXT NOT NULL,
        retry_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (sos_id, digest)
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_retry ON outbox(retry_at);
      CREATE INDEX IF NOT EXISTS idx_outbox_expires ON outbox(expires_at);
    `);
  }

  getByKey(sosId: string, digest: string): OutboxEntryMeta | null {
    const row = this.db
      .prepare(`SELECT * FROM outbox WHERE sos_id = ? AND digest = ?`)
      .get(sosId, digest) as Record<string, unknown> | undefined;
    return row ? rowToMeta(row) : null;
  }

  enqueue(input: EnqueueInput, nowMs: number): OutboxEntryMeta {
    const existing = this.getByKey(input.sosId, input.digest);
    if (existing) {
      return existing;
    }
    const retention = input.retentionMs ?? this.defaultRetentionMs;
    const expiresAt = nowMs + retention;
    const insert = this.db.prepare(`
      INSERT INTO outbox (
        sos_id, digest, origin, encrypted_blob, state,
        retry_at, expires_at, last_error, created_at, updated_at
      ) VALUES (
        @sosId, @digest, @origin, @encryptedBlobBase64, 'LOCAL_SAVED',
        @retryAt, @expiresAt, NULL, @nowMs, @nowMs
      )
    `);
    insert.run({
      sosId: input.sosId,
      digest: input.digest,
      origin: input.origin,
      encryptedBlobBase64: input.encryptedBlobBase64,
      retryAt: nowMs,
      expiresAt,
      nowMs,
    });
    return this.getByKey(input.sosId, input.digest)!;
  }

  getBySosId(sosId: string): OutboxEntryMeta | null {
    const row = this.db
      .prepare(`SELECT * FROM outbox WHERE sos_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(sosId) as Record<string, unknown> | undefined;
    return row ? rowToMeta(row) : null;
  }

  listAll(): OutboxEntryMeta[] {
    const rows = this.db.prepare(`SELECT * FROM outbox ORDER BY created_at ASC`).all() as Record<
      string,
      unknown
    >[];
    return rows.map(rowToMeta);
  }

  updateState(
    sosId: string,
    state: TransportState,
    nowMs: number,
    lastError: string | null = null
  ): OutboxEntryMeta | null {
    const info = this.db
      .prepare(
        `UPDATE outbox SET state = ?, updated_at = ?, last_error = ? WHERE sos_id = ?`
      )
      .run(state, nowMs, lastError, sosId);
    if (info.changes === 0) {
      return null;
    }
    return this.getBySosId(sosId);
  }

  setRetryAt(sosId: string, retryAtMs: number, lastError: string | null): void {
    this.db
      .prepare(`UPDATE outbox SET retry_at = ?, last_error = ? WHERE sos_id = ?`)
      .run(retryAtMs, lastError, sosId);
  }

  countDueForSend(nowMs: number, paused: boolean): number {
    if (paused) {
      return 0;
    }
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM outbox
         WHERE retry_at <= ? AND state NOT IN ('FAILED', 'EXPIRED')`
      )
      .get(nowMs) as { c: number };
    return row.c;
  }

  purgeExpired(nowMs: number): number {
    const info = this.db
      .prepare(`DELETE FROM outbox WHERE expires_at <= ?`)
      .run(nowMs);
    return info.changes;
  }

  /** Flush WAL into the main database file before abrupt process termination. */
  checkpointWal(): void {
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  close(): void {
    this.db.close();
  }
}
