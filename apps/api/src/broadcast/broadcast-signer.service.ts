import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey, sign, verify, type KeyObject } from 'node:crypto';

@Injectable()
export class BroadcastSignerService implements OnModuleInit {
  private privateKey!: KeyObject;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const encoded = this.config.get<string>('INGEST_RECEIPT_SIGNING_PRIVATE_KEY');
    if (!encoded) {
      throw new Error('INGEST_RECEIPT_SIGNING_PRIVATE_KEY is required for broadcast signing');
    }
    const der = Buffer.from(encoded, 'base64');
    this.privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  }

  signBroadcast(
    id: string,
    title: string,
    body: string,
    severity: string,
    createdAt: Date,
    expiresAt: Date,
    regionLatitude?: number | null,
    regionLongitude?: number | null,
    regionRadiusKm?: number | null
  ): string {
    const regionPart = regionLatitude != null && regionLongitude != null && regionRadiusKm != null
      ? `|${regionLatitude}|${regionLongitude}|${regionRadiusKm}`
      : '';
    const payload = Buffer.from(
      `BROADCAST|${id}|${title}|${body}|${severity}|${createdAt.toISOString()}|${expiresAt.toISOString()}${regionPart}`,
      'utf8'
    );
    return sign(null, payload, this.privateKey).toString('base64');
  }

  verifyBroadcast(
    id: string,
    title: string,
    body: string,
    severity: string,
    createdAt: string,
    expiresAt: string,
    signature: string,
    regionLatitude?: number | null,
    regionLongitude?: number | null,
    regionRadiusKm?: number | null
  ): boolean {
    try {
      const regionPart = regionLatitude != null && regionLongitude != null && regionRadiusKm != null
        ? `|${regionLatitude}|${regionLongitude}|${regionRadiusKm}`
        : '';
      const payload = Buffer.from(
        `BROADCAST|${id}|${title}|${body}|${severity}|${createdAt}|${expiresAt}${regionPart}`,
        'utf8'
      );
      const publicKey = this.privateKey.export({ type: 'spki', format: 'der' });
      return verify(null, payload, { key: publicKey, format: 'der', type: 'spki' }, Buffer.from(signature, 'base64'));
    } catch {
      return false;
    }
  }
}
