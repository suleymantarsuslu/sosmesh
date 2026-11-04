import { Injectable, Logger } from '@nestjs/common';
import { IncidentState, Prisma } from '@prisma/client';
import type { EncryptedPayload, ServerCryptoConfig } from '@sosmesh/contracts';

import { PrismaService } from '../prisma/prisma.service';
import { parseInnerPayloadV2, senderKeyHash, type InnerPayloadV2 } from './inner-payload-v2';
import { ProfileCrypto } from './profile-crypto';
import { decideSenderRate, SENDER_WINDOW_MS, SenderRateLimitedException } from './sender-rate-limit';
import { senderLogTag } from './server-key-derivation';

let decryptPayloadFn: typeof import('@sosmesh/contracts').decryptPayload | null = null;
async function getDecryptPayload() {
  if (!decryptPayloadFn) {
    const { decryptPayload } = await import('@sosmesh/contracts');
    decryptPayloadFn = decryptPayload;
  }
  return decryptPayloadFn;
}

export const MERGE_WINDOW_MS = 24 * 3_600_000;
const OPEN_STATES: IncidentState[] = [IncidentState.PENDING, IncidentState.ASSIGNED, IncidentState.IN_PROGRESS];

export type MeshV2Context = {
  inner: InnerPayloadV2;
  senderId: string;
  senderTag: string;
  fullProcessing: boolean;
};

/**
 * Mesh v2 ingest steps (docs/protocol/mesh-v2.md §8.2). Everything here is best-effort except the
 * per-sender hard limit: a payload that cannot be decrypted or is not v2 is ingested exactly like v1.
 */
@Injectable()
export class MeshV2IngestService {
  private readonly logger = new Logger(MeshV2IngestService.name);
  private readonly profileCrypto = new ProfileCrypto();

  constructor(private readonly prisma: PrismaService) {}

  /** Decrypts L3 in memory. Returns null for v1 inners, missing key or any decrypt error. */
  async decryptInner(encryptedPayload: string, clientAad: unknown): Promise<InnerPayloadV2 | null> {
    const config = this.serverConfig();
    if (!config || !encryptedPayload) {
      return null;
    }
    let parsed: EncryptedPayload;
    try {
      parsed = JSON.parse(encryptedPayload) as EncryptedPayload;
    } catch {
      return null;
    }
    if (parsed.keyId !== config.keyId) {
      return null;
    }
    try {
      const decrypt = await getDecryptPayload();
      return parseInnerPayloadV2(decrypt(parsed, clientAad, config));
    } catch {
      this.logger.warn({ code: 'INNER_DECRYPT_FAILED' });
      return null;
    }
  }

  /**
   * Upserts the sender and applies the per-sender limit. Throws SenderRateLimitedException above 60/h.
   * Never stores the senderKey; only SHA-256 of its bytes.
   * @param priority envelope priority (0-9, lower is more urgent)
   */
  async prepare(inner: InnerPayloadV2, now: Date = new Date(), priority = 5): Promise<MeshV2Context> {
    const hash = senderKeyHash(inner.senderKey);
    const sender = await this.prisma.sosSender.upsert({
      where: { senderKeyHash: hash },
      create: { senderKeyHash: hash, lastSeenAt: now },
      update: { lastSeenAt: now },
      select: { id: true },
    });
    const since = new Date(now.getTime() - SENDER_WINDOW_MS);
    const [count, oldest] = await Promise.all([
      this.prisma.sosMessage.count({ where: { senderId: sender.id, receivedAt: { gte: since } } }),
      this.prisma.sosMessage.findFirst({
        where: { senderId: sender.id, receivedAt: { gte: since } },
        orderBy: { receivedAt: 'asc' },
        select: { receivedAt: true },
      }),
    ]);
    const hasRealContent = !!(inner.note || inner.location || priority <= 2);
    const decision = decideSenderRate(count, oldest?.receivedAt ?? null, now, hasRealContent);
    const senderTag = senderLogTag(hash, now);
    if (decision.action === 'reject') {
      this.logger.warn({ code: 'SENDER_RATE_LIMITED', senderTag, retryAfterSeconds: decision.retryAfterSeconds });
      throw new SenderRateLimitedException(decision.retryAfterSeconds);
    }
    return { inner, senderId: sender.id, senderTag, fullProcessing: decision.fullProcessing };
  }

  /**
   * Inside the ingest transaction: serialise per sender, then return the open incident to merge into
   * (same sender, not resolved/cancelled, updated within 24 h), or null to create a new one.
   */
  async findMergeTarget(
    tx: Prisma.TransactionClient,
    senderId: string,
    now: Date = new Date()
  ): Promise<{ id: string; latestLocationAt: Date | null } | null> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${senderId}, 0))`;
    return tx.incident.findFirst({
      where: {
        senderId,
        state: { in: OPEN_STATES },
        deletedAt: null,
        updatedAt: { gte: new Date(now.getTime() - MERGE_WINDOW_MS) },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, latestLocationAt: true },
    });
  }

  /** Incident columns for the newest location; only when the inner location is newer than the stored one. */
  latestLocationUpdate(
    inner: InnerPayloadV2,
    currentLatestAt: Date | null
  ): {
    latestLatitude: number;
    latestLongitude: number;
    latestAccuracyMeters: number | null;
    latestLocationAt: Date;
  } | null {
    const loc = inner.location;
    if (!loc) {
      return null;
    }
    const at = new Date(loc.timestamp);
    if (currentLatestAt && at.getTime() <= currentLatestAt.getTime()) {
      return null;
    }
    return {
      latestLatitude: loc.latitude,
      latestLongitude: loc.longitude,
      latestAccuracyMeters: loc.accuracyMeters ?? null,
      latestLocationAt: at,
    };
  }

  /** Keeps only the newest profile per sender (by seq), encrypted at rest. */
  async storeLatestProfile(tx: Prisma.TransactionClient, ctx: MeshV2Context): Promise<void> {
    const profile = ctx.inner.profile;
    if (!profile || !this.profileCrypto.available) {
      return;
    }
    const seq = BigInt(ctx.inner.seq);
    const existing = await tx.sosSenderProfile.findUnique({
      where: { senderId: ctx.senderId },
      select: { sourceSeq: true },
    });
    if (existing && existing.sourceSeq >= seq) {
      return;
    }
    const data = {
      ciphertext: this.profileCrypto.encrypt(ctx.senderId, profile),
      keyVersion: this.profileCrypto.keyVersion,
      sourceSeq: seq,
    };
    await tx.sosSenderProfile.upsert({
      where: { senderId: ctx.senderId },
      create: { senderId: ctx.senderId, ...data },
      update: data,
    });
  }

  private serverConfig(): ServerCryptoConfig | null {
    const privateKey = process.env.SOSMESH_SERVER_SOS_PRIVATE_KEY;
    const keyId = process.env.SOSMESH_SERVER_SOS_KEY_ID;
    if (!privateKey || !keyId) {
      return null;
    }
    if (process.env.NODE_ENV === 'production' && keyId.startsWith('dev-test')) {
      return null;
    }
    return { keyId, serverPrivateKey: privateKey, serverPublicKey: '' };
  }
}
