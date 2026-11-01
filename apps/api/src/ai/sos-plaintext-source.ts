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
