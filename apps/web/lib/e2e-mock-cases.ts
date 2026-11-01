import { NextResponse } from 'next/server';

import type { FeedEvent, OperatorCaseRow } from '../features/case-list/types';

/** Fixed synthetic IDs — not real incidents or PII. */
export const E2E_CASE_GPS_ID = 'e2e11111-1111-4111-8111-111111111101';
export const E2E_CASE_UNKNOWN_ID = 'e2e22222-2222-4222-8222-222222222202';

const BASE_CASES: OperatorCaseRow[] = [
  {
    incidentId: E2E_CASE_GPS_ID,
    incidentState: 'PENDING',
    messageId: 'e2e-msg-gps-001',
    sosMessageId: 'e2e-msg-gps-001',
    priority: 1,
    sosType: 'MEDICAL',
    deliveryState: 'SERVER_ACCEPTED',
    locationStatus: 'GPS',
    latitude: 39.94,
    longitude: 32.86,
    accuracyMeters: 120,
    receivedAt: '2026-11-01T10:00:00.000Z',
    source: 'relay-synth-a',
  },
  {
    incidentId: E2E_CASE_UNKNOWN_ID,
    incidentState: 'PENDING',
    messageId: 'e2e-msg-unknown-001',
    sosMessageId: 'e2e-msg-unknown-001',
    priority: 2,
    sosType: 'GENERAL',
    deliveryState: 'SERVER_ACCEPTED',
    locationStatus: 'UNKNOWN',
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    receivedAt: '2026-11-01T10:05:00.000Z',
    source: 'relay-synth-b',
  },
];

let feedSeq = 0;
let liveEventEmitted = false;

export function mockCasesResponse(searchParams: URLSearchParams) {
  let items = [...BASE_CASES];
  const category = searchParams.get('category');
  if (category) {
    items = items.filter((row) => row.sosType === category);
  }
  const search = searchParams.get('search')?.toLowerCase();
  if (search) {
    items = items.filter(
      (row) =>
        row.incidentId.toLowerCase().includes(search) ||
        row.messageId.toLowerCase().includes(search)
    );
  }
  const seedCount = Number(searchParams.get('seedCount') ?? '0');
  if (Number.isFinite(seedCount) && seedCount > 0) {
    const extra: OperatorCaseRow[] = [];
    for (let i = 0; i < seedCount; i += 1) {
      extra.push({
        incidentId: `e2e-seed-${String(i).padStart(4, '0')}-0000-4000-8000-000000000000`,
        incidentState: 'PENDING',
        messageId: `e2e-seed-msg-${i}`,
        sosMessageId: `e2e-seed-msg-${i}`,
        priority: (i % 3) + 1,
        sosType: 'GENERAL',
        deliveryState: 'SERVER_ACCEPTED',
        locationStatus: i % 5 === 0 ? 'UNKNOWN' : 'GPS',
        latitude: i % 5 === 0 ? null : 39.9 + (i % 50) * 0.001,
        longitude: i % 5 === 0 ? null : 32.8 + (i % 50) * 0.001,
        accuracyMeters: i % 5 === 0 ? null : 50 + (i % 200),
        receivedAt: new Date(Date.UTC(2026, 10, 1, 10, 0, i)).toISOString(),
        source: 'seed',
      });
    }
    items = [...items, ...extra];
  }
  return NextResponse.json({ items, nextCursor: null, limit: 100 });
}

export function mockCaseDetailResponse(incidentId: string) {
  const row = BASE_CASES.find((item) => item.incidentId === incidentId);
  if (!row) {
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({
    ...row,
    timeline: [
      {
        id: 'e2e-timeline-1',
        deliveryState: 'SERVER_ACCEPTED',
        source: row.source ?? 'ingest',
        createdAt: row.receivedAt,
      },
    ],
  });
}

export function mockEventsPoll(after: string) {
  const afterNum = Number(after);
  const events: FeedEvent[] = [];
  if (!liveEventEmitted && afterNum >= 0) {
    liveEventEmitted = true;
    feedSeq += 1;
    events.push({
      id: String(feedSeq),
      messageId: 'e2e-live-msg-001',
      incidentId: 'e2e33333-3333-4333-8333-333333333303',
      priority: 1,
      locationStatus: 'GPS',
      latitude: 39.95,
      longitude: 32.87,
      occurredAt: new Date().toISOString(),
    });
  }
  return NextResponse.json({ events });
}

export function mockSseResponse() {
  const stream = new ReadableStream({
    start(controller) {
      feedSeq += 1;
      const event: FeedEvent = {
        id: String(feedSeq),
        messageId: 'e2e-sse-msg-001',
        incidentId: 'e2e44444-4444-4444-8444-444444444404',
        priority: 1,
        locationStatus: 'GPS',
        latitude: 39.96,
        longitude: 32.88,
        occurredAt: new Date().toISOString(),
      };
      controller.enqueue(
        new TextEncoder().encode(`id: ${event.id}\nevent: incident_message\ndata: ${JSON.stringify(event)}\n\n`)
      );
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export function resetE2eMockCasesState() {
  feedSeq = 0;
  liveEventEmitted = false;
}
