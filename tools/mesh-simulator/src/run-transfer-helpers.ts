import { encryptPayload } from '@sosmesh/contracts';

import type { LabFixtureCase } from './fixtures';

const TEST_KEYS = {
  keyId: 'dev-test-001',
  serverPublicKey: 'BFu/Jxfj3txqvjTtUW7BTYK3iX0E/ysPPwPNk091o1c=',
};

export function buildBlePayloadFromFixture(fixture: LabFixtureCase): Buffer {
  const encrypted = encryptPayload(
    { note: fixture.plaintextNote, synthetic: true },
    fixture.envelope,
    { keyId: TEST_KEYS.keyId, serverPublicKey: TEST_KEYS.serverPublicKey }
  );
  return Buffer.from(JSON.stringify(encrypted), 'utf-8');
}
