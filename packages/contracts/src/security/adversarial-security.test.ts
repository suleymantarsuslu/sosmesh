import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

import * as testKeys from '../../crypto-test-vectors/test-keys.json';
import {
  decryptPayload,
  encryptPayload,
  sanitizeForLog,
} from '../crypto';
import {
  MeshRelayEngine,
  buildDedupKey,
  relayLogSnapshot,
  type MeshRelayEnvelopeV2,
} from '../protocol-v2/mesh-relay-engine';

const fixturesDir = path.join(__dirname, '../../fixtures/security');

type MeshFixtureFile = {
  relayDeviceIdHash: string;
  validBase: MeshRelayEnvelopeV2;
  expectDrop: Array<{
    id: string;
    patch: Record<string, unknown>;
    relayDeviceIdHash?: string;
    dropReason: string | null;
    decision?: 'FORWARD' | 'DROP';
    seedDedup?: boolean;
  }>;
  duplicateFlood: { id: string; attempts: number; expectForwards: number; expectDrops: number };
};

type CryptoFixtureFile = {
  tamperCases: Array<{
    id: string;
    field: string;
    mode: string;
  }>;
};

type SchemaFixtureFile = {
  schemaPath: string;
  invalidDocuments: Array<{
    id: string;
    omit?: string[];
    add?: Record<string, unknown>;
    patch?: Record<string, unknown>;
    document?: unknown;
  }>;
};

function loadJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

function mergeEnvelope(
  base: MeshRelayEnvelopeV2,
  patch: Record<string, unknown>
): MeshRelayEnvelopeV2 {
  return { ...base, ...patch } as MeshRelayEnvelopeV2;
}

describe('adim43_mesh_relay_adversarial_fixtures', () => {
  const meshFixtures = loadJson<MeshFixtureFile>('adversarial-mesh-relay.json');

  it.each(meshFixtures.expectDrop.map((row) => [row.id, row] as const))(
    '%s enforces relay guard outcome',
    (_id, row) => {
      const engine = new MeshRelayEngine({ lruCapacity: 512 });
      const envelope = mergeEnvelope(meshFixtures.validBase, row.patch);
      const relayHash = row.relayDeviceIdHash ?? meshFixtures.relayDeviceIdHash;
      if (row.seedDedup) {
        engine.seedDedupKey(buildDedupKey(envelope));
      }
      const outcome = engine.evaluateForward(envelope, relayHash);
      if (row.decision) {
        expect(outcome.decision).toBe(row.decision);
      } else {
        expect(outcome.decision).toBe('DROP');
      }
      if (row.dropReason) {
        expect(outcome.dropReason).toBe(row.dropReason);
      }
    }
  );

  it('adv_mesh_duplicate_flood caps relay amplification', () => {
    const engine = new MeshRelayEngine({ lruCapacity: 256 });
    const envelope = mergeEnvelope(meshFixtures.validBase, {
      messageId: 'flood-msg-001',
    });
    const relayHash = meshFixtures.relayDeviceIdHash;
    let forwards = 0;
    let drops = 0;
    for (let i = 0; i < meshFixtures.duplicateFlood.attempts; i += 1) {
      const outcome = engine.evaluateForward(envelope, relayHash);
      if (outcome.decision === 'FORWARD') {
        forwards += 1;
      } else {
        drops += 1;
      }
    }
    expect(forwards).toBe(meshFixtures.duplicateFlood.expectForwards);
    expect(drops).toBe(meshFixtures.duplicateFlood.expectDrops);
  });

  it('mesh_relay_log_never_contains_embedded_sos_plaintext', () => {
    const sosPlaintext = 'SENTETIK_SOS_YARDIM_METNI_ADIM43';
    const envelope = mergeEnvelope(meshFixtures.validBase, {
      messageId: 'privacy-log-001',
      opaqueCiphertextBase64: Buffer.from(sosPlaintext, 'utf-8').toString('base64'),
    });
    const snapshot = relayLogSnapshot(envelope);
    expect(snapshot).not.toContain(sosPlaintext);
    expect(sanitizeForLog({ sosText: sosPlaintext }).sosText).toBe('[REDACTED]');
  });
});

describe('adim43_crypto_adversarial_fixtures', () => {
  const cryptoFixtures = loadJson<CryptoFixtureFile>('adversarial-crypto.json');
  const config = {
    keyId: testKeys.keyId,
    serverPublicKey: testKeys.serverPublicKey,
    serverPrivateKey: testKeys.serverPrivateKey,
  };
  const payload = {
    sosText: 'SENTETIK_ADIM43_CRYPTO_FIXTURE',
    category: 'general',
    personsCount: 1,
    injuries: false,
    userLanguage: 'tr',
  };
  const envelope = {
    timestamp: '2026-11-01T12:00:00Z',
    location: { latitude: 40.0, longitude: 29.0, accuracy: 50 },
    priority: 2,
    ackLevel: 'DEVICE_STORED',
    relayCount: 0,
  };

  let priorEncrypted: ReturnType<typeof encryptPayload> | undefined;

  function tamper(
    encrypted: ReturnType<typeof encryptPayload>,
    mode: string,
    field: string
  ): ReturnType<typeof encryptPayload> {
    const copy = { ...encrypted };
    if (mode === 'flip_first_byte' && (field === 'ciphertext' || field === 'nonce')) {
      const bytes = Buffer.from(copy[field], 'base64');
      bytes[0] ^= 0x01;
      copy[field] = bytes.toString('base64');
      return copy;
    }
    if (mode === 'replace_with_zeros' && field === 'ephemeralPublicKey') {
      copy.ephemeralPublicKey = Buffer.alloc(32).toString('base64');
      return copy;
    }
    if (mode === 'set_unknown_key' && field === 'keyId') {
      copy.keyId = 'unknown-key-id-adim43';
      return copy;
    }
    if (mode === 'truncate_tail' && field === 'ciphertext') {
      copy.ciphertext = copy.ciphertext.slice(0, 8);
      return copy;
    }
    if (mode === 'empty_string' && field === 'ciphertext') {
      copy.ciphertext = '';
      return copy;
    }
    if (mode === 'swap_with_nonce' && field === 'ciphertext') {
      const swapped = copy.nonce;
      copy.nonce = copy.ciphertext;
      copy.ciphertext = swapped;
      return copy;
    }
    if (mode === 'reuse_prior_nonce' && field === 'nonce' && priorEncrypted) {
      copy.nonce = priorEncrypted.nonce;
      return copy;
    }
    return copy;
  }

  it.each(cryptoFixtures.tamperCases.map((row) => [row.id, row] as const))(
    '%s rejects tampered ciphertext or metadata',
    (_id, row) => {
      const encrypted = encryptPayload(payload, envelope, config);
      if (row.mode === 'reuse_prior_nonce') {
        priorEncrypted = encrypted;
        const second = encryptPayload(payload, envelope, config);
        const tampered = tamper(second, row.mode, row.field);
        expect(() => decryptPayload(tampered, envelope, config)).toThrow();
        return;
      }
      let envForDecrypt = envelope;
      if (row.field.startsWith('envelope.')) {
        const key = row.field.split('.')[1];
        if (row.mode === 'shift_time') {
          envForDecrypt = {
            ...envelope,
            timestamp: '2026-11-01T13:00:00Z',
          };
        }
        if (row.mode === 'increment' && key === 'priority') {
          envForDecrypt = { ...envelope, priority: envelope.priority + 1 };
        }
      }
      const tampered = tamper(encrypted, row.mode, row.field);
      expect(() => decryptPayload(tampered, envForDecrypt, config)).toThrow();
    }
  );
});

describe('adim43_schema_adversarial_fixtures', () => {
  const schemaFixtures = loadJson<SchemaFixtureFile>('adversarial-schema.json');
  const meshFixtures = loadJson<MeshFixtureFile>('adversarial-mesh-relay.json');
  const schemaFullPath = path.join(__dirname, '../../', schemaFixtures.schemaPath);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(fs.readFileSync(schemaFullPath, 'utf-8')));

  function buildDocument(row: SchemaFixtureFile['invalidDocuments'][number]): unknown {
    if ('document' in row) {
      return row.document;
    }
    const doc: Record<string, unknown> = { ...meshFixtures.validBase };
    if (row.omit) {
      for (const key of row.omit) {
        delete doc[key];
      }
    }
    if (row.patch) {
      Object.assign(doc, row.patch);
    }
    if (row.add) {
      Object.assign(doc, row.add);
    }
    return doc;
  }

  it.each(schemaFixtures.invalidDocuments.map((row) => [row.id, row] as const))(
    '%s fails mesh-relay-envelope-v2 schema validation',
    (_id, row) => {
      const doc = buildDocument(row);
      const ok = validate(doc);
      expect(ok).toBe(false);
      expect(validate.errors?.length ?? 0).toBeGreaterThan(0);
    }
  );
});

describe('adim43_adversarial_fixture_count', () => {
  it('documents at least 30 adversarial fixture ids', () => {
    const mesh = loadJson<MeshFixtureFile>('adversarial-mesh-relay.json');
    const crypto = loadJson<CryptoFixtureFile>('adversarial-crypto.json');
    const schema = loadJson<SchemaFixtureFile>('adversarial-schema.json');
    const ids = [
      ...mesh.expectDrop.map((row) => row.id),
      mesh.duplicateFlood.id,
      ...crypto.tamperCases.map((row) => row.id),
      ...schema.invalidDocuments.map((row) => row.id),
    ];
    expect(ids.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
