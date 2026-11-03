import { Injectable, Logger } from '@nestjs/common';
import type { EncryptedPayload, ServerCryptoConfig } from '@sosmesh/contracts';
import { PrismaService } from '../prisma/prisma.service';

// Lazy-load crypto to avoid ESM import issues in Jest
let decryptPayloadFn: typeof import('@sosmesh/contracts').decryptPayload | null = null;
async function getDecryptPayload() {
  if (!decryptPayloadFn) {
    const { decryptPayload } = await import('@sosmesh/contracts');
    decryptPayloadFn = decryptPayload;
  }
  return decryptPayloadFn;
}

export type SosPlaintextRequest = {
  incidentId: string;
  messageId: string;
};

/**
 * Server-side decryption port for SOS note text (ADIM 9 key model).
 * Envelope / relay-visible fields must never carry plaintext.
 */
export interface SosPlaintextSource {
  getPlaintext(request: SosPlaintextRequest): Promise<string | null>;
}

export const SOS_PLAINTEXT_SOURCE = 'SOS_PLAINTEXT_SOURCE';

/** M0: ciphertext is not decrypted on the server; AI runs only after a future decrypt port. */
export class NullSosPlaintextSource implements SosPlaintextSource {
  async getPlaintext(): Promise<string | null> {
    return null;
  }
}

/**
 * ServerKey plaintext source - decrypts SOS payloads with production server key
 * Work Package A - AI Foundation
 * 
 * Uses X25519+ChaCha20-Poly1305 from @sosmesh/contracts
 * Production rejects dev-test-001 key
 */
@Injectable()
export class ServerKeyPlaintextSource implements SosPlaintextSource {
  private readonly logger = new Logger(ServerKeyPlaintextSource.name);
  private readonly serverConfig: ServerCryptoConfig | null;

  constructor(private readonly prisma: PrismaService) {
    const privateKey = process.env.SOSMESH_SERVER_SOS_PRIVATE_KEY;
    const keyId = process.env.SOSMESH_SERVER_SOS_KEY_ID;

    if (!privateKey || !keyId) {
      this.serverConfig = null;
      this.logger.log('Server SOS decryption not configured (no key)');
      return;
    }

    // Production must reject dev-test keys
    if (process.env.NODE_ENV === 'production' && keyId.startsWith('dev-test')) {
      throw new Error('Production environment must not use dev-test keys');
    }

    this.serverConfig = {
      keyId,
      serverPrivateKey: privateKey,
      serverPublicKey: '', // Not needed for decrypt
    };

    this.logger.log({ msg: 'Server SOS decryption configured', keyId });
  }

  async getPlaintext(request: SosPlaintextRequest): Promise<string | null> {
    if (!this.serverConfig) {
      return null;
    }

    try {
      const sosMessage = await this.prisma.sosMessage.findUnique({
        where: { messageId: request.messageId },
        select: {
          id: true,
          noteText: true,
          encryptedNoteBlob: true,
          synthetic: true,
          latitude: true,
          longitude: true,
          locationStatus: true,
        },
      });

      if (!sosMessage) {
        return null;
      }

      // Return cached plaintext if already decrypted
      if (sosMessage.noteText) {
        return sosMessage.noteText;
      }

      // Synthetic messages don't have encrypted payloads
      if (sosMessage.synthetic) {
        return null;
      }

      // No encrypted payload available
      if (!sosMessage.encryptedNoteBlob) {
        return null;
      }

      // Parse encrypted payload
      let encryptedPayload: EncryptedPayload;
      try {
        encryptedPayload = JSON.parse(sosMessage.encryptedNoteBlob) as EncryptedPayload;
      } catch {
        this.logger.error({
          code: 'INVALID_ENCRYPTED_PAYLOAD',
          messageId: request.messageId,
        });
        return null;
      }

      // Check if keyId matches
      if (encryptedPayload.keyId !== this.serverConfig.keyId) {
        this.logger.debug({
          msg: 'KeyId mismatch',
          messageId: request.messageId,
          expectedKeyId: this.serverConfig.keyId,
          actualKeyId: encryptedPayload.keyId,
        });
        return null;
      }

      // Build envelope for AAD verification
      const envelope = {
        locationStatus: sosMessage.locationStatus,
        ...(sosMessage.latitude && sosMessage.longitude
          ? {
              location: {
                latitude: Number(sosMessage.latitude),
                longitude: Number(sosMessage.longitude),
              },
            }
          : {}),
      };

      // Decrypt payload
      const decryptPayload = await getDecryptPayload();
      const decrypted = decryptPayload(encryptedPayload, envelope, this.serverConfig);

      const noteText = decrypted.sosText ?? decrypted.note ?? null;

      if (!noteText) {
        this.logger.warn({
          code: 'NO_TEXT_IN_PAYLOAD',
          messageId: request.messageId,
        });
        return null;
      }

      // Cache decrypted plaintext
      await this.prisma.sosMessage.update({
        where: { id: sosMessage.id },
        data: { noteText },
      });

      this.logger.log({
        msg: 'SOS decrypted',
        messageId: request.messageId,
        textLength: noteText.length,
      });

      return noteText;
    } catch (error) {
      // Log only error codes, never payloads or error objects that may contain sensitive data
      const errorCode = error instanceof Error && error.message.includes('Key ID mismatch')
        ? 'KEY_ID_MISMATCH'
        : error instanceof Error && error.message.includes('DECRYPTION_FAILED')
        ? 'DECRYPTION_FAILED'
        : 'DECRYPT_ERROR';

      this.logger.error({
        code: errorCode,
        messageId: request.messageId,
      });
      return null;
    }
  }
}
