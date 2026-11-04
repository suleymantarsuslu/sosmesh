import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

@Injectable()
export class BroadcastSignerService implements OnModuleInit {
  private privateKey!: KeyObject;
  private publicKey!: KeyObject;
  private publicKeyBase64!: string;

  constructor(private readonly config: ConfigService) {}
  
  static canonicalize(params: {
    id: string;
    title: string;
    body: string;
    severity: string;
    createdAt: string;
    expiresAt: string;
    regionLatitude?: number | null;
    regionLongitude?: number | null;
    regionRadiusKm?: number | null;
    kind?: string;
  }): string {
    const regionPart = params.regionLatitude != null && params.regionLongitude != null && params.regionRadiusKm != null
      ? `|${params.regionLatitude}|${params.regionLongitude}|${params.regionRadiusKm}`
      : '';
    const kindPart = params.kind === 'relay_request' ? '|relay_request' : '';
    return `BROADCAST|${params.id}|${params.title}|${params.body}|${params.severity}|${params.createdAt}|${params.expiresAt}${regionPart}${kindPart}`;
  }

  onModuleInit(): void {
    const encoded = this.config.get<string>('INGEST_RECEIPT_SIGNING_PRIVATE_KEY');
    if (!encoded) {
      throw new Error('INGEST_RECEIPT_SIGNING_PRIVATE_KEY is required for broadcast signing');
    }
    const der = Buffer.from(encoded, 'base64');
    this.privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    this.publicKey = createPublicKey(this.privateKey);
    const publicKeyDer = this.publicKey.export({ type: 'spki', format: 'der' });
    this.publicKeyBase64 = Buffer.from(publicKeyDer as Buffer).toString('base64');
  }

  getPublicKeyBase64(): string {
    return this.publicKeyBase64;
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
    regionRadiusKm?: number | null,
    kind?: string
  ): string {
    const regionPart = regionLatitude != null && regionLongitude != null && regionRadiusKm != null
      ? `|${regionLatitude}|${regionLongitude}|${regionRadiusKm}`
      : '';
    const kindPart = kind === 'relay_request' ? '|relay_request' : '';
    const payload = Buffer.from(
      `BROADCAST|${id}|${title}|${body}|${severity}|${createdAt.toISOString()}|${expiresAt.toISOString()}${regionPart}${kindPart}`,
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
    regionRadiusKm?: number | null,
    kind?: string
  ): boolean {
    try {
      const regionPart = regionLatitude != null && regionLongitude != null && regionRadiusKm != null
        ? `|${regionLatitude}|${regionLongitude}|${regionRadiusKm}`
        : '';
      const kindPart = kind === 'relay_request' ? '|relay_request' : '';
      const payload = Buffer.from(
        `BROADCAST|${id}|${title}|${body}|${severity}|${createdAt}|${expiresAt}${regionPart}${kindPart}`,
        'utf8'
      );
      return verify(null, payload, this.publicKey, Buffer.from(signature, 'base64'));
    } catch {
      return false;
    }
  }
}
