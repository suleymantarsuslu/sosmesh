import { execSync } from 'child_process';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

describe('m0_logcat_redaction', () => {
  const repoRoot = join(__dirname, '..', '..');

  function redactLine(line: string): string {
    return execSync(
      `node --input-type=module -e "import { redactLogcatLine } from './scripts/m0/redact-logcat.mjs'; console.log(redactLogcatLine(process.argv[1]));" ${JSON.stringify(line)}`,
      { cwd: repoRoot, encoding: 'utf-8' }
    ).trimEnd();
  }

  it('masks SOS field values through end of line', () => {
    const messageLine =
      '11-01 10:00:00.000 1234 5678 I SOSMesh: message=Yardim lazim evim cok kötü';
    const plaintextLine = 'plaintext: bina yikildi 3 kisi var';
    const redactedMessage = redactLine(messageLine);
    const redactedPlain = redactLine(plaintextLine);
    expect(redactedMessage).toContain('message=[REDACTED_TEXT]');
    expect(redactedMessage).not.toContain('Yardim lazim');
    expect(redactedPlain).toContain('plaintext: [REDACTED_TEXT]');
    expect(redactedPlain).not.toContain('bina yikildi');
  });

  it('masks coordinates, email, and phone patterns', () => {
    const line = 'gps 39.931234 32.861111 user@example.com id 905551234567';
    const redacted = redactLine(line);
    expect(redacted).not.toContain('39.931234');
    expect(redacted).not.toContain('32.861111');
    expect(redacted).toContain('[REDACTED_COORD]');
    expect(redacted).toContain('[REDACTED_EMAIL]');
    expect(redacted).toContain('[REDACTED_PHONE]');
    expect(redacted).not.toContain('user@example.com');
    expect(redacted).not.toContain('905551234567');
  });
});
