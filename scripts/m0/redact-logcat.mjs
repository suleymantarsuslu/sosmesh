/**
 * Redact a single logcat line before writing M0 evidence.
 * Used by collect-logs.sh and vitest (tests/chaos/m0-redact-logcat.test.ts).
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SOS_FIELD_PATTERN =
  /\b(message|msg|text|plaintext|note|body|sosText)(\s*[:=]\s*).+$/gi;

export function redactLogcatLine(line) {
  let out = line;
  out = out.replace(/[-+]?[0-9]{1,3}\.[0-9]{4,}/g, '[REDACTED_COORD]');
  out = out.replace(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    '[REDACTED_EMAIL]'
  );
  out = out.replace(/\b[0-9]{10,14}\b/g, '[REDACTED_PHONE]');
  out = out.replace(SOS_FIELD_PATTERN, '$1$2[REDACTED_TEXT]');
  return out;
}

function redactStream(input) {
  const lines = input.split(/\r?\n/);
  const lastIndex = lines.length - 1;
  return lines
    .map((line, index) => {
      if (line.length === 0 && index === lastIndex && input.endsWith('\n')) {
        return '';
      }
      return redactLogcatLine(line);
    })
    .join('\n');
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const chunks = [];
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('end', () => {
    process.stdout.write(redactStream(chunks.join('')));
  });
}
