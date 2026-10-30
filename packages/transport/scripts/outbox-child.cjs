/**
 * Child process CLI for outbox persistence (process kill / restart tests).
 * Usage: node outbox-child.cjs <command> <dbPath> [sosId] [digest]
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { SqliteOutboxQueue } = require('../dist/sqlite-outbox-queue');

const command = process.argv[2];
const dbPath = process.argv[3];
const sosId = process.argv[4] ?? 'sos-subprocess-1';
const digest = process.argv[5] ?? 'digest-abc';

function main() {
  if (!command || !dbPath) {
    process.stderr.write('usage: outbox-child <enqueue|count|list> <dbPath>\n');
    process.exit(2);
  }

  const queue = new SqliteOutboxQueue(dbPath);

  if (command === 'enqueue') {
    queue.enqueue(
      {
        sosId,
        digest,
        origin: 'subprocess-test',
        encryptedBlobBase64: Buffer.from('cipher').toString('base64'),
      },
      Date.now()
    );
    queue.close();
    process.stdout.write('ok\n');
    process.exit(0);
  }

  if (command === 'count') {
    const n = queue.listAll().length;
    queue.close();
    process.stdout.write(String(n) + '\n');
    process.exit(0);
  }

  if (command === 'list') {
    const ids = queue.listAll().map((e) => e.sosId).join(',');
    queue.close();
    process.stdout.write(ids + '\n');
    process.exit(0);
  }

  queue.close();
  process.stderr.write('unknown command\n');
  process.exit(2);
}

main();
