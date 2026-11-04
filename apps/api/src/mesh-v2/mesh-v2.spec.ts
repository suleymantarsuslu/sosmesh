/**
 * Mesh v2 server pieces (docs/protocol/mesh-v2.md §6, §8, §12, §13). All data is fake.
 */
import { computeAddressAssumption, haversineMeters } from './address-assumption';
import { parseInnerPayloadV2, senderKeyHash } from './inner-payload-v2';
import { MeshV2IngestService } from './mesh-v2-ingest.service';
import { ProfileCrypto } from './profile-crypto';
import { parseLookupRequest, ReceiptsLookupService } from './receipts-lookup.service';
import { decideSenderRate, SenderRateLimitedException } from './sender-rate-limit';
import { deriveDayKey, deriveSubkey, HKDF_INFO_DAY_KEY, HKDF_INFO_PROFILE_AT_REST, senderLogTag } from './server-key-derivation';

const decryptMock = jest.fn();
jest.mock('@sosmesh/contracts', () => ({ decryptPayload: (...args: unknown[]) => decryptMock(...args) }));

const FAKE_SENDER_KEY = 'a'.repeat(64);
const FAKE_ENV = { SOSMESH_SERVER_SOS_PRIVATE_KEY: 'fake-test-secret-not-a-real-key' } as NodeJS.ProcessEnv;
const minimalInner = { innerVersion: 2, senderKey: FAKE_SENDER_KEY, seq: 1, createdAt: '2026-11-04T00:00:00.000Z' };

describe('inner payload v2', () => {
  it('accepts the empty SOS (only the four required fields)', () => {
    expect(parseInnerPayloadV2(minimalInner)).toEqual(minimalInner);
  });

  it('treats v1 inners and broken required fields as "not v2"', () => {
    expect(parseInnerPayloadV2({ sos_text: 'v1' })).toBeNull();
    expect(parseInnerPayloadV2({ ...minimalInner, senderKey: 'XYZ' })).toBeNull();
    expect(parseInnerPayloadV2({ ...minimalInner, seq: 0 })).toBeNull();
    expect(parseInnerPayloadV2({ ...minimalInner, createdAt: 'nope' })).toBeNull();
  });

  it('drops invalid optional fields instead of rejecting the SOS', () => {
    const parsed = parseInnerPayloadV2({
      ...minimalInner,
      personCount: 99,
      location: { latitude: 200, longitude: 0, timestamp: '2026-11-04T00:00:00Z' },
      profile: { fullName: 'Test Person', phone: 'not-a-phone', householdSize: 3 },
    });
    expect(parsed?.personCount).toBeUndefined();
    expect(parsed?.location).toBeUndefined();
    expect(parsed?.profile).toEqual({ fullName: 'Test Person', householdSize: 3 });
  });

  it('hashes the raw 32 senderKey bytes, not the hex text', () => {
    expect(senderKeyHash('00'.repeat(32))).toBe('66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925');
  });
});

describe('server key derivation (HKDF, no new secret)', () => {
  it('derives stable, label-separated 32-byte keys', () => {
    const a = deriveSubkey(HKDF_INFO_PROFILE_AT_REST, FAKE_ENV);
    expect(a?.length).toBe(32);
    expect(deriveSubkey(HKDF_INFO_PROFILE_AT_REST, FAKE_ENV)?.equals(a as Buffer)).toBe(true);
    expect(deriveSubkey(HKDF_INFO_DAY_KEY, FAKE_ENV)?.equals(a as Buffer)).toBe(false);
  });

  it('rotates the day key at the UTC day boundary', () => {
    const d1 = deriveDayKey(new Date('2026-11-04T23:59:59Z'), FAKE_ENV);
    const d1b = deriveDayKey(new Date('2026-11-04T00:00:00Z'), FAKE_ENV);
    const d2 = deriveDayKey(new Date('2026-11-05T00:00:00Z'), FAKE_ENV);
    expect(d1?.equals(d1b as Buffer)).toBe(true);
    expect(d1?.equals(d2 as Buffer)).toBe(false);
    expect(senderLogTag('b'.repeat(64), new Date('2026-11-04T10:00:00Z'), FAKE_ENV)).toMatch(/^[a-f0-9]{8}$/);
  });

  it('returns null without the existing server secret', () => {
    expect(deriveSubkey(HKDF_INFO_PROFILE_AT_REST, {} as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe('profile encryption at rest', () => {
  const profile = { fullName: 'Test Person', floor: 3, householdSize: 2 };

  it('round-trips and binds the ciphertext to its sender row', () => {
    const crypto = new ProfileCrypto(FAKE_ENV);
    const ct = crypto.encrypt('sender-1', profile);
    expect(ct).not.toContain('Test Person');
    expect(crypto.decrypt('sender-1', ct)).toEqual(profile);
    expect(crypto.decrypt('sender-2', ct)).toBeNull();
  });

  it('is unavailable without the server secret', () => {
    expect(new ProfileCrypto({} as NodeJS.ProcessEnv).available).toBe(false);
  });
});

describe('address assumption (panel-infer-in / -out)', () => {
  const home = { latitude: 41.0, longitude: 29.0 };
  const at = (meters: number) => ({ latitude: 41.0 + meters / 111_195, longitude: 29.0, accuracyMeters: 20 });

  it('shows the inference at 80 m with floor and household size', () => {
    const result = computeAddressAssumption(at(80), { homeLocation: home, floor: 4, householdSize: 3 }, null);
    expect(result).toMatchObject({ kind: 'AT_REGISTERED_ADDRESS', inference: true, floor: 4, personCount: 3 });
    expect(result?.distanceMeters).toBeGreaterThanOrEqual(79);
  });

  it('prefers the SOS personCount over householdSize', () => {
    expect(computeAddressAssumption(at(10), { homeLocation: home, householdSize: 3 }, 5)?.personCount).toBe(5);
  });

  it('hides it at 150 m, with poor accuracy or without device-geocoded home', () => {
    expect(computeAddressAssumption(at(150), { homeLocation: home }, null)).toBeNull();
    expect(computeAddressAssumption({ ...at(10), accuracyMeters: 500 }, { homeLocation: home }, null)).toBeNull();
    expect(computeAddressAssumption(at(10), { floor: 2 }, null)).toBeNull();
    expect(computeAddressAssumption(null, { homeLocation: home }, null)).toBeNull();
  });

  it('haversine is sane', () => {
    expect(Math.round(haversineMeters(41, 29, 41.001, 29))).toBe(111);
  });
});

describe('per-sender rate limit (server-429)', () => {
  const now = new Date('2026-11-04T12:00:00Z');

  it('accepts with full processing up to 30/h and merges without re-triage up to 60/h', () => {
    expect(decideSenderRate(0, null, now)).toEqual({ action: 'accept', fullProcessing: true });
    expect(decideSenderRate(29, now, now)).toEqual({ action: 'accept', fullProcessing: true });
    expect(decideSenderRate(30, now, now)).toEqual({ action: 'accept', fullProcessing: false });
    expect(decideSenderRate(59, now, now)).toEqual({ action: 'accept', fullProcessing: false });
  });

  it('rejects the 61st message in the hour with Retry-After until the window frees up', () => {
    const oldest = new Date(now.getTime() - 3_590_000);
    expect(decideSenderRate(60, oldest, now)).toEqual({ action: 'reject', retryAfterSeconds: 10 });
    expect(decideSenderRate(60, new Date(now.getTime() - 60_000), now)).toEqual({ action: 'reject', retryAfterSeconds: 900 });
  });
});

describe('MeshV2IngestService', () => {
  const envBefore = { ...process.env };
  afterEach(() => {
    process.env = { ...envBefore };
  });

  function prismaMock(countInWindow: number) {
    return {
      sosSender: { upsert: jest.fn().mockResolvedValue({ id: 'sender-1' }) },
      sosMessage: {
        count: jest.fn().mockResolvedValue(countInWindow),
        findFirst: jest.fn().mockResolvedValue({ receivedAt: new Date('2026-11-04T11:30:00Z') }),
      },
    };
  }

  it('upserts only the senderKeyHash and throws 429 above 60/h', async () => {
    const prisma = prismaMock(60);
    const service = new MeshV2IngestService(prisma as never);
    const inner = parseInnerPayloadV2(minimalInner)!;
    await expect(service.prepare(inner, new Date('2026-11-04T12:00:00Z'))).rejects.toBeInstanceOf(
      SenderRateLimitedException
    );
    const upsertArg = prisma.sosSender.upsert.mock.calls[0][0];
    expect(JSON.stringify(upsertArg)).not.toContain(FAKE_SENDER_KEY);
    expect(upsertArg.where.senderKeyHash).toBe(senderKeyHash(FAKE_SENDER_KEY));
  });

  it('keeps the newest location only', () => {
    const service = new MeshV2IngestService({} as never);
    const inner = parseInnerPayloadV2({
      ...minimalInner,
      location: { latitude: 41, longitude: 29, accuracyMeters: 10, timestamp: '2026-11-04T10:00:00Z' },
    })!;
    expect(service.latestLocationUpdate(inner, null)).toMatchObject({ latestLatitude: 41, latestLongitude: 29 });
    expect(service.latestLocationUpdate(inner, new Date('2026-11-04T11:00:00Z'))).toBeNull();
    expect(service.latestLocationUpdate(parseInnerPayloadV2(minimalInner)!, null)).toBeNull();
  });

  it('stores only the latest profile per sender, encrypted', async () => {
    process.env.SOSMESH_SERVER_SOS_PRIVATE_KEY = 'fake-test-secret-not-a-real-key';
    const service = new MeshV2IngestService({} as never);
    const tx = {
      sosSenderProfile: {
        findUnique: jest.fn().mockResolvedValue({ sourceSeq: BigInt(5) }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const ctx = (seq: number) => ({
      inner: parseInnerPayloadV2({ ...minimalInner, seq, profile: { fullName: 'Test Person' } })!,
      senderId: 'sender-1',
      senderTag: 'tag',
      fullProcessing: true,
    });
    await service.storeLatestProfile(tx as never, ctx(4));
    expect(tx.sosSenderProfile.upsert).not.toHaveBeenCalled();
    await service.storeLatestProfile(tx as never, ctx(6));
    const arg = tx.sosSenderProfile.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ senderId: 'sender-1' });
    expect(arg.update.sourceSeq).toBe(BigInt(6));
    expect(JSON.stringify(arg, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('Test Person');
  });

  it('decrypts an empty v2 inner (inner-empty), ignores v1 inners and never throws', async () => {
    process.env.SOSMESH_SERVER_SOS_PRIVATE_KEY = 'fake-test-secret-not-a-real-key';
    process.env.SOSMESH_SERVER_SOS_KEY_ID = 'test-key-1';
    const aad = { locationStatus: 'UNKNOWN', timestamp: '2026-11-04T00:00:00.000Z' };
    decryptMock.mockImplementation((payload: { ciphertext: string }, envelope: typeof aad) => {
      if (envelope.timestamp !== aad.timestamp) throw new Error('AAD mismatch');
      return payload.ciphertext === 'v2' ? minimalInner : { sos_text: 'x' };
    });
    const service = new MeshV2IngestService({} as never);
    const wire = (ciphertext: string, keyId = 'test-key-1') =>
      JSON.stringify({ keyId, ephemeralPublicKey: 'e', nonce: 'n', ciphertext });

    expect(await service.decryptInner(wire('v2'), aad)).toEqual(minimalInner);
    expect(await service.decryptInner(wire('v1'), aad)).toBeNull();
    expect(await service.decryptInner(wire('v2'), { ...aad, timestamp: 'tampered' })).toBeNull();
    expect(await service.decryptInner(wire('v2', 'other-key'), aad)).toBeNull();
    expect(await service.decryptInner('not json', aad)).toBeNull();
    delete process.env.SOSMESH_SERVER_SOS_PRIVATE_KEY;
    expect(await service.decryptInner(wire('v2'), aad)).toBeNull();
  });
});

describe('receipts lookup', () => {
  const hash = 'c'.repeat(64);
  const item = { messageId: '11111111-1111-4111-8111-111111111111', packetHash: hash };

  it('validates the request shape', () => {
    expect(parseLookupRequest({ items: [item] })).toEqual([item]);
    expect(() => parseLookupRequest({ items: [] })).toThrow();
    expect(() => parseLookupRequest({ items: Array(65).fill(item) })).toThrow();
    expect(() => parseLookupRequest({ items: [{ messageId: item.messageId }] })).toThrow();
    expect(() => parseLookupRequest({ items: [{ ...item, packetHash: 'ABC' }] })).toThrow();
    expect(() => parseLookupRequest({ items: [{ ...item, extra: 1 }] })).toThrow();
  });

  it('returns a signed receipt only when messageId AND packetHash match', async () => {
    const at = new Date('2026-11-04T00:00:00.000Z');
    const prisma = {
      sosMessage: {
        findMany: jest.fn().mockResolvedValue([
          { messageId: item.messageId, packetHash: hash, serverReceiptAt: at, receivedAt: at },
          { messageId: 'other-message-id', packetHash: 'd'.repeat(64), serverReceiptAt: at, receivedAt: at },
        ]),
      },
    };
    const signer = { signServerAccepted: jest.fn().mockReturnValue('sig') };
    const service = new ReceiptsLookupService(prisma as never, signer as never);

    const result = await service.lookup([item, { messageId: 'other-message-id', packetHash: hash }]);

    expect(result.receipts).toEqual([
      { ackType: 'SERVER_ACCEPTED', messageId: item.messageId, packetHash: hash, timestamp: at.toISOString(), signature: 'sig', hopsLeft: 8 },
    ]);
    expect(prisma.sosMessage.findMany.mock.calls[0][0].where).toEqual({
      messageId: { in: [item.messageId, 'other-message-id'] },
    });
  });
});
