import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..');

export interface LabFixtureCase {
  id: string;
  description: string;
  envelope: Record<string, unknown>;
  plaintextNote: string;
}

export function loadUnicodeFixtureEnvelope(): Record<string, unknown> {
  const raw = JSON.parse(
    readFileSync(join(REPO_ROOT, 'packages/fixtures/protocol-v1/unicode-sos.json'), 'utf-8')
  ) as { envelope: Record<string, unknown> };
  return {
    ...raw.envelope,
    location: { unknown: true },
  };
}

export const LAB_FIXTURES: LabFixtureCase[] = [
  {
    id: 'no-gps',
    description: 'Konum bilinmiyor — sentetik envelope',
    envelope: {
      timestamp: '2026-10-30T12:00:00Z',
      location: { unknown: true },
      priority: 1,
      ackLevel: 'PEER_RECEIVED',
    },
    plaintextNote: 'SENTETIK_YARDIM_TALEBI_NO_GPS',
  },
  {
    id: 'unicode-multilingual',
    description: 'Türkçe, Arapça, emoji — şifreli taşınır',
    envelope: loadUnicodeFixtureEnvelope(),
    plaintextNote: 'مرحبا_İstanbul_🚨_ÇŞĞÜÖİ',
  },
  {
    id: 'corrupt-target',
    description: 'Bozuk paket senaryosu için yüksek corrupt oranı ile birlikte kullanılır',
    envelope: {
      timestamp: '2026-10-30T12:05:00Z',
      location: { unknown: true },
      priority: 2,
      ackLevel: 'PEER_RECEIVED',
    },
    plaintextNote: 'CORRUPT_CASE_MARKER',
  },
];
