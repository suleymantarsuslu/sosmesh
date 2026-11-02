/**
 * Retention durations are intentionally unset until an operator explicitly configures them.
 * Do not ship default day counts in code — see ADR-013.
 */
export function readRetentionMaxAgeMs(): number | null {
  const raw = process.env.RETENTION_SOS_MESSAGE_MAX_AGE_SECONDS;
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.floor(seconds * 1000);
}

export function retentionJobEnabled(): boolean {
  return process.env.RETENTION_JOB_ENABLED === 'true';
}
