'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { CaseDrawer } from './CaseDrawer';
import { CaseFilters } from './CaseFilters';
import { CaseListPanel } from './CaseListPanel';
import { CasesAccessibleTable } from './CasesAccessibleTable';
import { applyCaseFilters, defaultCaseFilters } from './filter-cases';
import { hasPlottableCoordinates, isUnknownLocationQueue } from './geo';
import type { FeedEvent, OperatorCaseRow } from './types';
import { UnknownLocationQueue } from './UnknownLocationQueue';
import { useLiveFeed } from './useLiveFeed';
import { OperatorMap } from '../map/OperatorMap';

type TimelineEntry = {
  id: string;
  deliveryState: string;
  source: string;
  createdAt: string;
};

function feedEventToCase(event: FeedEvent, existing?: OperatorCaseRow): OperatorCaseRow {
  return {
    incidentId: event.incidentId,
    incidentState: existing?.incidentState ?? 'PENDING',
    messageId: event.messageId,
    sosMessageId: existing?.sosMessageId ?? event.messageId,
    priority: event.priority,
    sosType: existing?.sosType ?? 'GENERAL',
    deliveryState: existing?.deliveryState ?? 'SERVER_ACCEPTED',
    locationStatus: event.locationStatus,
    latitude: event.latitude,
    longitude: event.longitude,
    accuracyMeters: existing?.accuracyMeters ?? null,
    receivedAt: event.occurredAt,
    source: existing?.source ?? 'feed',
  };
}

export function CasesView({ initialCases }: { initialCases: OperatorCaseRow[] }) {
  const [cases, setCases] = useState<OperatorCaseRow[]>(initialCases);
  const [filters, setFilters] = useState(defaultCaseFilters());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [mapZoom, setMapZoom] = useState(6);

  const refreshCases = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (filters.category) {
      params.set('category', filters.category);
    }
    if (filters.incidentState) {
      params.set('incidentState', filters.incidentState);
    }
    if (filters.deliveryState) {
      params.set('deliveryState', filters.deliveryState);
    }
    if (filters.locationStatus) {
      params.set('locationStatus', filters.locationStatus);
    }
    if (filters.accuracyMax) {
      params.set('accuracyMax', filters.accuracyMax);
    }
    if (filters.search) {
      params.set('search', filters.search);
    }
    const res = await fetch(`/api/operator/cases?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) {
      return;
    }
    const body = (await res.json()) as { items: OperatorCaseRow[] };
    setCases(body.items);
  }, [filters]);

  const onFeedEvent = useCallback(
    (event: FeedEvent) => {
      setCases((prev) => {
        const existing = prev.find((row) => row.incidentId === event.incidentId);
        const nextRow = feedEventToCase(event, existing);
        const without = prev.filter((row) => row.incidentId !== event.incidentId);
        return [nextRow, ...without];
      });
    },
    []
  );

  const feed = useLiveFeed(onFeedEvent);

  const filtered = useMemo(() => applyCaseFilters(cases, filters), [cases, filters]);
  const plottable = useMemo(
    () => filtered.filter((row) => hasPlottableCoordinates(row)),
    [filtered]
  );
  const unknownQueue = useMemo(
    () => filtered.filter((row) => isUnknownLocationQueue(row)),
    [filtered]
  );
  const selectedRow = filtered.find((row) => row.incidentId === selectedId) ?? null;

  const openDrawer = useCallback(async (incidentId: string) => {
    setSelectedId(incidentId);
    const res = await fetch(`/api/operator/cases/${incidentId}`, { cache: 'no-store' });
    if (!res.ok) {
      setTimeline([]);
      return;
    }
    const body = (await res.json()) as { timeline: TimelineEntry[] };
    setTimeline(body.timeline ?? []);
  }, []);

  return (
    <div className="cases-view" data-testid="operator-cases-view">
      <header className="cases-view__header">
        <h1>Harita ve vakalar</h1>
        <div className="cases-view__live" role="status" data-testid="live-feed-status">
          {feed.connected ? 'Canlı bağlı' : 'Yedek senkronizasyon'}
          {feed.stale ? ' · veri bayat olabilir' : ''}
          <span className="cases-view__live-mode"> ({feed.mode})</span>
        </div>
        <button type="button" className="ui-button" onClick={() => refreshCases()}>
          Listeyi yenile
        </button>
      </header>

      <CaseFilters filters={filters} onChange={setFilters} />

      <div className="cases-view__layout">
        <div className="cases-view__map-column">
          <OperatorMap
            rows={plottable}
            selectedId={selectedId}
            onSelect={openDrawer}
            zoom={mapZoom}
            onZoomChange={setMapZoom}
          />
        </div>
        <div className="cases-view__side">
          <CaseListPanel rows={plottable} selectedId={selectedId} onSelect={openDrawer} />
          <UnknownLocationQueue
            rows={unknownQueue}
            selectedId={selectedId}
            onSelect={openDrawer}
          />
        </div>
      </div>

      <CasesAccessibleTable rows={filtered} />

      {selectedId ? (
        <p className="cases-view__detail-link">
          <Link href={`/operator/cases/${selectedId}`}>Vaka ayrıntısını aç</Link>
        </p>
      ) : null}

      <CaseDrawer
        open={selectedId !== null}
        row={selectedRow}
        timeline={timeline}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
