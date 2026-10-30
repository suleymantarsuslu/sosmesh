import { SqliteOutboxQueue } from './sqlite-outbox-queue';
import type { TransportState } from './fixture-path';

const command = process.argv[2];
const dbPath = process.argv[3];
const sosId = process.argv[4] ?? 'sos-subprocess-1';
const digest = process.argv[5] ?? 'digest-abc';
const stateAfterEnqueue = process.argv[6] as TransportState | undefined;

function usage(): never {
  process.stderr.write(
    'usage: outbox-child-cli <enqueue-wait> <dbPath> [sosId] [digest] [state]\n'
  );
  process.exit(2);
}

if (!command || !dbPath) {
  usage();
}

if (command !== 'enqueue-wait') {
  process.stderr.write(`unknown command: ${command}\n`);
  process.exit(2);
}

const queue = new SqliteOutboxQueue(dbPath);
queue.enqueue(
  {
    sosId,
    digest,
    origin: 'subprocess-test',
    encryptedBlobBase64: Buffer.from('cipher').toString('base64'),
  },
  Date.now()
);

if (stateAfterEnqueue) {
  queue.updateState(sosId, stateAfterEnqueue, Date.now());
}

queue.checkpointWal();
process.stdout.write('ready\n');
setInterval(() => {
  /* keep WAL connection open until SIGKILL */
}, 60_000);
