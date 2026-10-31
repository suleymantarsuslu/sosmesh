import fs from 'node:fs';

const statePath = process.argv[2];
if (!statePath || !fs.existsSync(statePath)) {
  process.exit(0);
}
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
try {
  process.kill(state.pid, 'SIGTERM');
} catch {
  // already stopped
}
