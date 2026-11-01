import type {
  SosPlaintextRequest,
  SosPlaintextSource,
} from '../../src/ai/sos-plaintext-source';

export class FakeSosPlaintextSource implements SosPlaintextSource {
  constructor(private readonly byMessageId: Record<string, string>) {}

  async getPlaintext(request: SosPlaintextRequest): Promise<string | null> {
    return this.byMessageId[request.messageId] ?? null;
  }
}
