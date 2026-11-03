/**
 * Device Upload Token Service - Generate and verify upload tokens
 * 
 * Binds upload capability to a specific SOS message using HMAC-SHA256
 * Only the device that received the ingest receipt can upload attachments
 */

import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class DeviceUploadTokenService implements OnModuleInit {
  private secret!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const encoded = this.config.get<string>('DEVICE_UPLOAD_TOKEN_SECRET');
    if (!encoded) {
      throw new Error('DEVICE_UPLOAD_TOKEN_SECRET is required');
    }
    this.secret = Buffer.from(encoded, 'base64');
  }

  /**
   * Generate an upload token for a specific message
   * Token format: messageId:hmac(messageId|packetHash)
   */
  generateToken(messageId: string, packetHash: string): string {
    const hmac = createHmac('sha256', this.secret)
      .update(`${messageId}|${packetHash}`)
      .digest('hex');
    return `${messageId}:${hmac}`;
  }

  /**
   * Verify and extract messageId from upload token
   * Throws UnauthorizedException if invalid
   */
  verifyToken(token: string, packetHash: string): string {
    const parts = token.split(':');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid upload token format');
    }

    const [messageId, providedHmac] = parts;

    const expectedHmac = createHmac('sha256', this.secret)
      .update(`${messageId}|${packetHash}`)
      .digest('hex');

    if (!timingSafeEqual(Buffer.from(expectedHmac, 'hex'), Buffer.from(providedHmac, 'hex'))) {
      throw new UnauthorizedException('Invalid upload token');
    }

    return messageId;
  }
}
