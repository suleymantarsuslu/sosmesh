/**
 * Parser for SosInnerPayloadV2 (packages/contracts/protocol-v2/schemas/sos-inner-payload-v2.schema.json).
 *
 * Lenient by design (invariant 3, SOS is never blocked): an invalid optional field is dropped, not rejected.
 * Only the four required fields decide whether the payload counts as v2 at all.
 */
import { createHash } from 'node:crypto';

export type SenderProfileV2 = {
  fullName?: string;
  age?: number;
  address?: { line?: string; district?: string; city?: string; postalCode?: string; country?: string };
  floor?: number;
  homeLocation?: { latitude: number; longitude: number };
  phone?: string;
  email?: string;
  householdSize?: number;
};

export type InnerLocationV2 = { latitude: number; longitude: number; accuracyMeters?: number; timestamp: string };

export type InnerPayloadV2 = {
  innerVersion: 2;
  senderKey: string;
  seq: number;
  createdAt: string;
  sosType?: 'GENERAL' | 'MEDICAL' | 'TRAPPED' | 'FIRE' | 'OTHER';
  note?: string;
  language?: string;
  location?: InnerLocationV2;
  personCount?: number;
  profile?: SenderProfileV2;
  profileChanged?: boolean;
};

const SOS_TYPES = new Set(['GENERAL', 'MEDICAL', 'TRAPPED', 'FIRE', 'OTHER']);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined;
const isDate = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));

/** SHA-256 over the 32 raw senderKey bytes (hex-decoded), lowercase hex. */
export function senderKeyHash(senderKeyHex: string): string {
  return createHash('sha256').update(Buffer.from(senderKeyHex, 'hex')).digest('hex');
}

export function parseInnerPayloadV2(raw: unknown): InnerPayloadV2 | null {
  if (!isObj(raw) || raw.innerVersion !== 2) {
    return null;
  }
  if (typeof raw.senderKey !== 'string' || !/^[a-f0-9]{64}$/.test(raw.senderKey)) {
    return null;
  }
  if (!isInt(raw.seq, 1, 4294967295) || !isDate(raw.createdAt)) {
    return null;
  }
  const out: InnerPayloadV2 = { innerVersion: 2, senderKey: raw.senderKey, seq: raw.seq, createdAt: raw.createdAt };
  if (typeof raw.sosType === 'string' && SOS_TYPES.has(raw.sosType)) {
    out.sosType = raw.sosType as InnerPayloadV2['sosType'];
  }
  const note = str(raw.note, 1000);
  if (note && Buffer.byteLength(note, 'utf8') <= 2000) out.note = note;
  if (typeof raw.language === 'string' && /^[a-z]{2}$/.test(raw.language)) out.language = raw.language;
  if (isObj(raw.location)) {
    const l = raw.location;
    if (isNum(l.latitude, -90, 90) && isNum(l.longitude, -180, 180) && isDate(l.timestamp)) {
      out.location = { latitude: l.latitude, longitude: l.longitude, timestamp: l.timestamp };
      if (isNum(l.accuracyMeters, 0, 100000)) out.location.accuracyMeters = l.accuracyMeters;
    }
  }
  if (isInt(raw.personCount, 1, 50)) out.personCount = raw.personCount;
  if (isObj(raw.profile)) {
    const profile = parseProfile(raw.profile);
    if (profile) out.profile = profile;
  }
  if (typeof raw.profileChanged === 'boolean') out.profileChanged = raw.profileChanged;
  return out;
}

function parseProfile(p: Record<string, unknown>): SenderProfileV2 | null {
  const out: SenderProfileV2 = {};
  const fullName = str(p.fullName, 100);
  if (fullName) out.fullName = fullName;
  if (isInt(p.age, 0, 130)) out.age = p.age;
  if (isObj(p.address)) {
    const a = p.address;
    const address: NonNullable<SenderProfileV2['address']> = {};
    const line = str(a.line, 300);
    const district = str(a.district, 80);
    const city = str(a.city, 80);
    const postalCode = str(a.postalCode, 16);
    if (line) address.line = line;
    if (district) address.district = district;
    if (city) address.city = city;
    if (postalCode) address.postalCode = postalCode;
    if (typeof a.country === 'string' && /^[A-Z]{2}$/.test(a.country)) address.country = a.country;
    if (Object.keys(address).length > 0) out.address = address;
  }
  if (isInt(p.floor, -10, 200)) out.floor = p.floor;
  if (isObj(p.homeLocation) && isNum(p.homeLocation.latitude, -90, 90) && isNum(p.homeLocation.longitude, -180, 180)) {
    out.homeLocation = { latitude: p.homeLocation.latitude, longitude: p.homeLocation.longitude };
  }
  if (typeof p.phone === 'string' && /^\+[1-9][0-9]{6,14}$/.test(p.phone)) out.phone = p.phone;
  const email = str(p.email, 254);
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.email = email;
  if (isInt(p.householdSize, 1, 50)) out.householdSize = p.householdSize;
  return Object.keys(out).length > 0 ? out : null;
}
