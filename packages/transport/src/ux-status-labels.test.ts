import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { loadStateTransitionsFixture, repoRootFromPackage } from '../src';

/**
 * UX / a11y: status timeline labels must not conflate peer hop with operator seen.
 */
describe('UX status label semantics (content-tr.json)', () => {
  const root = repoRootFromPackage();
  const contentTr = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/ux/content-tr.json'), 'utf8')
  ) as {
    status: { timeline: Record<string, string> };
  };
  const fixture = loadStateTransitionsFixture();

  it('maps PEER_RECEIVED label without operator wording', () => {
    const peerKey = fixture.uxTimelineKeys.PEER_RECEIVED;
    const peerLabel = contentTr.status.timeline[peerKey];
    expect(peerLabel).toBe('YAKIN CİHAZA AKTARILDI');
    expect(peerLabel.toLowerCase()).not.toContain('operatör');
    expect(peerLabel.toLowerCase()).not.toContain('okundu');
  });

  it('maps OPERATOR_SEEN label without implying peer delivery only', () => {
    const opKey = fixture.uxTimelineKeys.OPERATOR_SEEN;
    const opLabel = contentTr.status.timeline[opKey];
    expect(opLabel).toBe('OPERATÖR GÖRDÜ');
    const peerKey = fixture.uxTimelineKeys.PEER_RECEIVED;
    const peerLabel = contentTr.status.timeline[peerKey];
    expect(opLabel).not.toBe(peerLabel);
  });

  it('peer label text must not contain operator seen meaning', () => {
    const peerLabel = contentTr.status.timeline['2'];
    const operatorLabel = contentTr.status.timeline['4'];
    expect(peerLabel).not.toEqual(operatorLabel);
    expect(peerLabel.includes('OPERATÖR')).toBe(false);
  });
});
