'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CaseDetailPanel } from './CaseDetailPanel';
import { CaseDrawer } from './CaseDrawer';
import { CaseFilters } from './CaseFilters';
import { CaseListPanel } from './CaseListPanel';
import { CasesAccessibleTable } from './CasesAccessibleTable';
import { applyCaseFilters, defaultCaseFilters } from './filter-cases';
import { hasPlottableCoordinates, isUnknownLocationQueue } from './geo';
import type { FeedEvent, OperatorCaseRow } from './types';
import { UnknownLocationQueue } from './UnknownLocationQueue';
import { useLiveFeed } from './useLiveFeed';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { OperatorMap, type OperatorMapHandle } from '../map/OperatorMap';
import { AssignmentPreviewPanel } from '../assignment/AssignmentPreviewPanel';
import type { AssignmentPreviewRoute } from '../assignment/types';

type TimelineEntry = {
  id: string;
  deliveryState: string;
  source: string;
  createdAt: string;
};

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

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
    locationApproximate: existing?.locationApproximate ?? false,
    receivedAt: event.occurredAt,
    source: existing?.source ?? 'feed',
  };
}

export function CasesView({ initialCases }: { initialCases: OperatorCaseRow[] }) {
  const { activeIncidentId, t } = useOperatorPreferences();
  const [cases, setCases] = useState<OperatorCaseRow[]>(initialCases);
  const [filters, setFilters] = useState(defaultCaseFilters());
  const [now, setNow] = useState(Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [mapZoom, setMapZoom] = useState(6);
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentPreviewRoute | null>(null);
  const mapRef = useRef<OperatorMapHandle>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  const filtered = useMemo(() => {
    const base = applyCaseFilters(cases, filters);
    if (!activeIncidentId) {
      return base;
    }
    return base.filter((row) => row.incidentId === activeIncidentId);
  }, [cases, filters, activeIncidentId]);
  const plottable = useMemo(
    () => filtered.filter((row) => hasPlottableCoordinates(row)),
    [filtered]
  );
  const unknownQueue = useMemo(
    () => filtered.filter((row) => isUnknownLocationQueue(row)),
    [filtered]
  );
  const selectedRow = filtered.find((row) => row.incidentId === selectedId) ?? null;
  const selectedCoordinates =
    selectedRow &&
    selectedRow.latitude !== null &&
    selectedRow.longitude !== null &&
    hasPlottableCoordinates(selectedRow)
      ? { latitude: selectedRow.latitude, longitude: selectedRow.longitude }
      : null;

  const openDrawer = useCallback(async (incidentId: string) => {
    setSelectedId(incidentId);
    const res = await fetch(`/api/operator/cases/${incidentId}`, { cache: 'no-store' });
    if (!res.ok) {
      setTimeline([]);
      return;
    }
    const body = (await res.json()) as { timeline: TimelineEntry[] };
    setTimeline(body.timeline ?? []);
    
    const selectedCase = cases.find((row) => row.incidentId === incidentId);
    if (selectedCase && selectedCase.latitude !== null && selectedCase.longitude !== null && hasPlottableCoordinates(selectedCase)) {
      mapRef.current?.flyTo(selectedCase.latitude, selectedCase.longitude, 14);
    }
  }, [cases]);

  return (
    <div className="cases-view cases-view--modern" data-testid="operator-cases-view">
      <div className="cases-view__filters-bar">
        <div 
          className={`cases-view__live-badge ${
            !feed.connected ? 'cases-view__live-badge--disconnected' : 
            feed.mode === 'sse' ? 'cases-view__live-badge--connected' : 
            'cases-view__live-badge--polling'
          }`} 
          role="status" 
          data-testid="live-feed-status"
        >
          <span className={`cases-view__live-indicator ${feed.connected ? 'cases-view__live-indicator--connected' : ''}`} aria-hidden="true" />
          {!feed.connected ? t('web.cases.liveDisconnected') :
           feed.mode === 'sse' ? t('web.cases.liveConnected') :
           t('web.cases.livePolling')}
          {feed.connected && feed.lastEventAt && (Date.now() - feed.lastEventAt > 30000) && 
            ` (${t('web.cases.liveUpdatedAgo').replace('{{time}}', formatTimeAgo(now - feed.lastEventAt))})`}
        </div>
        <CaseFilters filters={filters} onChange={setFilters} />
        <button type="button" className="cases-view__refresh-button" onClick={() => refreshCases()} aria-label={t('web.cases.refreshList')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 10C4 6.686 6.686 4 10 4C11.848 4 13.506 4.816 14.625 6.125M16 10C16 13.314 13.314 16 10 16C8.152 16 6.494 15.184 5.375 13.875M14.625 6.125L14 3M14.625 6.125L18 6M5.375 13.875L6 17M5.375 13.875L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="cases-view__map-container">
        <OperatorMap
          ref={mapRef}
          rows={plottable}
          selectedId={selectedId}
          onSelect={openDrawer}
          zoom={mapZoom}
          onZoomChange={setMapZoom}
          assignmentPreview={assignmentPreview}
        />
        
        <aside className="cases-view__floating-panel">
          <div className="cases-view__panel-header">
            <h2 className="cases-view__panel-title">{t('web.cases.caseListTitle')}</h2>
            <span className="cases-view__panel-count">{plottable.length}</span>
          </div>
          <CaseListPanel rows={plottable} selectedId={selectedId} onSelect={openDrawer} />
          {unknownQueue.length > 0 && (
            <UnknownLocationQueue
              rows={unknownQueue}
              selectedId={selectedId}
              onSelect={openDrawer}
            />
          )}
        </aside>
      </div>

      <CasesAccessibleTable rows={filtered} />

      {selectedId ? (
        <p className="cases-view__detail-link">
          <Link href={`/operator/cases/${selectedId}`}>{t('web.cases.openDetailLink')}</Link>
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
