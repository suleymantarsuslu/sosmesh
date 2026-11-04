import { createHmac, hkdfSync } from 'node:crypto';

/**
 * Mesh v2 server-side subkeys (docs/protocol/mesh-v2.md §12.1).
 *
 * No new production secret: every subkey is HKDF-SHA256 derived from the existing
 * SOSMESH_SERVER_SOS_PRIVATE_KEY, each with its own `info` label so keys are independent.
 * Rotating the SOS key therefore rotates these subkeys too (profiles encrypted under the old
 * subkey become unreadable; they are re-sent by the device on its next SOS).
 */
export const HKDF_INFO_PROFILE_AT_REST = 'sosmesh/mesh-v2/profile-at-rest/aes-256-gcm/v1';
export const HKDF_INFO_DAY_KEY = 'sosmesh/mesh-v2/day-key/v1';
export const PROFILE_KEY_VERSION = 'hkdf1';

const SALT = 'sosmesh-mesh-v2';

function serverSecret(env: NodeJS.ProcessEnv): Buffer | null {
  const secret = env.SOSMESH_SERVER_SOS_PRIVATE_KEY;
  if (!secret || secret.trim().length === 0) {
    return null;
  }
  return Buffer.from(secret.trim(), 'utf8');
}

export function deriveSubkey(info: string, env: NodeJS.ProcessEnv = process.env, saltSuffix = ''): Buffer | null {
  const ikm = serverSecret(env);
  if (!ikm) {
    return null;
  }
  return Buffer.from(hkdfSync('sha256', ikm, Buffer.from(SALT + saltSuffix, 'utf8'), Buffer.from(info, 'utf8'), 32));
}

/** UTC day number (days since epoch). */
export function utcDayNumber(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 86_400_000);
}

/**
 * Day-rotating server key: same value for every request in one UTC day, unlinkable across days.
 * Used to pseudonymise sender ids in logs/events (`senderTag`), so log lines cannot be joined across days.
 */
export function deriveDayKey(at: Date = new Date(), env: NodeJS.ProcessEnv = process.env): Buffer | null {
  return deriveSubkey(HKDF_INFO_DAY_KEY, env, `:day:${utcDayNumber(at)}`);
}

/** 8-hex pseudonym for logs. Never log the senderKeyHash itself. */
export function senderLogTag(senderKeyHash: string, at: Date = new Date(), env: NodeJS.ProcessEnv = process.env): string {
  const key = deriveDayKey(at, env);
  if (!key) {
    return 'nokey';
  }
  return createHmac('sha256', key).update(senderKeyHash, 'utf8').digest('hex').slice(0, 8);
}
