import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey, sign, type KeyObject } from 'node:crypto';

@Injectable()
export class ReceiptSignerService implements OnModuleInit {
  private privateKey!: KeyObject;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const encoded = this.config.get<string>('INGEST_RECEIPT_SIGNING_PRIVATE_KEY');
    if (!encoded) {
      throw new Error('INGEST_RECEIPT_SIGNING_PRIVATE_KEY is required');
    }
    const der = Buffer.from(encoded, 'base64');
    this.privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  }

  signServerAccepted(messageId: string, timestamp: Date): string {
    const payload = Buffer.from(
      `SERVER_ACCEPTED|${messageId}|${timestamp.toISOString()}`,
      'utf8'
    );
    return sign(null, payload, this.privateKey).toString('base64');
  }
}
