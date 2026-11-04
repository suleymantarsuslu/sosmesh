import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { deriveSubkey, HKDF_INFO_PROFILE_AT_REST, PROFILE_KEY_VERSION } from './server-key-derivation';
import type { SenderProfileV2 } from './inner-payload-v2';

/** AES-256-GCM, format `base64(iv12 | tag16 | ciphertext)`; AAD binds the ciphertext to its sender row. */
export class ProfileCrypto {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  get available(): boolean {
    return deriveSubkey(HKDF_INFO_PROFILE_AT_REST, this.env) !== null;
  }

  get keyVersion(): string {
    return PROFILE_KEY_VERSION;
  }

  encrypt(senderId: string, profile: SenderProfileV2): string {
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(`sos_sender_profile:${senderId}`, 'utf8'));
    const body = Buffer.concat([cipher.update(JSON.stringify(profile), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }

  decrypt(senderId: string, ciphertext: string): SenderProfileV2 | null {
    const key = deriveSubkey(HKDF_INFO_PROFILE_AT_REST, this.env);
    if (!key) {
      return null;
    }
    try {
      const raw = Buffer.from(ciphertext, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      decipher.setAAD(Buffer.from(`sos_sender_profile:${senderId}`, 'utf8'));
      decipher.setAuthTag(raw.subarray(12, 28));
      const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
      return JSON.parse(plain) as SenderProfileV2;
    } catch {
      return null;
    }
  }

  private key(): Buffer {
    const key = deriveSubkey(HKDF_INFO_PROFILE_AT_REST, this.env);
    if (!key) {
      throw new Error('Profile encryption key unavailable');
    }
    return key;
  }
}
