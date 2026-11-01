import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { validateSosMessage } from '@sosmesh/contracts/dist/validator';

import {
  CLOCK_SKEW_SECONDS,
  DEFAULT_TTL_SECONDS,
  MAX_ENVELOPE_AGE_SECONDS,
  MAX_INGEST_BODY_BYTES,
  SUPPORTED_PROTOCOL_VERSION,
} from './ingest.constants';
import type { IngestRequestDto } from './dto/ingest-request.dto';
import { findForbiddenEnvelopeFieldKey } from './envelope-sensitive-fields';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export function computePacketHash(sosMessage: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(sosMessage), 'utf8').digest('hex');
}

@Injectable()
export class IngestPacketService {
  assertWithinSizeLimit(rawBodyBytes: number): void {
    if (rawBodyBytes > MAX_INGEST_BODY_BYTES) {
      throw new HttpException(
        {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Ingest body exceeds maximum allowed size',
        },
        HttpStatus.PAYLOAD_TOO_LARGE
      );
    }
  }

  validateRequest(dto: IngestRequestDto): {
    messageId: string;
    sosMessage: Record<string, unknown>;
  } {
    const sosMessage = dto.sosMessage;
    if (!sosMessage || typeof sosMessage !== 'object' || Array.isArray(sosMessage)) {
      throw new HttpException(
        { code: 'INVALID_SOS_PACKET', message: 'sosMessage must be an object' },
        HttpStatus.BAD_REQUEST
      );
    }

    const version = sosMessage.version;
    if (typeof version !== 'number' || version !== SUPPORTED_PROTOCOL_VERSION) {
      throw new HttpException(
        {
          code: 'UNSUPPORTED_PROTOCOL_VERSION',
          message: `Protocol version must be ${SUPPORTED_PROTOCOL_VERSION}`,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const schemaResult = validateSosMessage(sosMessage);
    if (!schemaResult.valid) {
      throw new HttpException(
        { code: 'INVALID_SOS_SCHEMA', message: 'SOS message failed schema validation' },
        HttpStatus.BAD_REQUEST
      );
    }

    const envelope = sosMessage.envelope as Record<string, unknown> | undefined;
    if (envelope && typeof envelope === 'object') {
      const forbiddenKey = findForbiddenEnvelopeFieldKey(envelope);
      if (forbiddenKey) {
        throw new HttpException(
          {
            code: 'ENVELOPE_SENSITIVE_FIELD',
            message: 'Envelope must not contain plaintext or message-like fields visible to relays',
          },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    const messageId = sosMessage.id;
    if (typeof messageId !== 'string') {
      throw new HttpException(
        { code: 'INVALID_SOS_PACKET', message: 'SOS message id is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    const expectedHash = computePacketHash(sosMessage);
    if (dto.transport.packetHash !== expectedHash) {
      throw new HttpException(
        { code: 'PACKET_HASH_MISMATCH', message: 'Packet hash does not match SOS payload' },
        HttpStatus.BAD_REQUEST
      );
    }

    this.assertEnvelopeTiming(sosMessage, dto.transport.ttlSeconds);

    return { messageId, sosMessage };
  }

  private assertEnvelopeTiming(
    sosMessage: Record<string, unknown>,
    ttlSeconds: number
  ): void {
    const envelope = sosMessage.envelope as Record<string, unknown> | undefined;
    const timestampRaw = envelope?.timestamp;
    if (typeof timestampRaw !== 'string') {
      throw new HttpException(
        { code: 'INVALID_ENVELOPE_TIME', message: 'Envelope timestamp is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const envelopeTime = Date.parse(timestampRaw);
    if (Number.isNaN(envelopeTime)) {
      throw new HttpException(
        { code: 'INVALID_ENVELOPE_TIME', message: 'Envelope timestamp is invalid' },
        HttpStatus.BAD_REQUEST
      );
    }

    const now = Date.now();
    const skewMs = CLOCK_SKEW_SECONDS * 1000;
    if (envelopeTime > now + skewMs) {
      throw new HttpException(
        { code: 'ENVELOPE_TIMESTAMP_FUTURE', message: 'Envelope timestamp is in the future' },
        HttpStatus.BAD_REQUEST
      );
    }

    const ageSeconds = (now - envelopeTime) / 1000;
    const ttl = ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS;
    if (ageSeconds > ttl) {
      throw new HttpException(
        { code: 'TTL_EXPIRED', message: 'SOS packet TTL has expired' },
        HttpStatus.BAD_REQUEST
      );
    }
    if (ageSeconds > MAX_ENVELOPE_AGE_SECONDS) {
      throw new HttpException(
        { code: 'ENVELOPE_TOO_OLD', message: 'Envelope timestamp is too old' },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
