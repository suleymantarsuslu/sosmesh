'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { RegionalSituationResponse, SituationFilters } from './types';
import { SituationCard } from './SituationCard';
import { SituationFiltersBar } from './SituationFiltersBar';

type Props = {
  initialData?: RegionalSituationResponse | null;
};

export function RegionalSituationPanel({ initialData }: Props) {
  const { t } = useOperatorPreferences();
  const [data, setData] = useState<RegionalSituationResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    initialData ? new Date(initialData.generatedAt) : null
  );

  const [filters, setFilters] = useState<SituationFilters>({
    windowHours: 24,
  });

  const fetchSituation = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const params = new URLSearchParams();
      params.set('windowHours', filters.windowHours.toString());
      if (filters.minUrgency) {
        params.set('minUrgency', filters.minUrgency);
      }

      const res = await fetch(`/api/operator/situation/regions?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch');
      }

      const result = (await res.json()) as RegionalSituationResponse;
      setData(result);
      setLastUpdated(new Date(result.generatedAt));
      setError(false);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSituation();
  }, [fetchSituation]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchSituation();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchSituation]);

  const isEmpty = !loading && !error && data?.clusters.length === 0;

  return (
    <section className="situation-panel" data-testid="regional-situation-panel">
      <header className="situation-panel__header">
        <div>
          <h2 className="situation-panel__title">{t('web.dashboard.regionalSituation.title')}</h2>
          <p className="situation-panel__description">
            {t('web.dashboard.regionalSituation.description')}
          </p>
        </div>
        <div className="situation-panel__meta">
          <span className="situation-panel__live-badge" data-testid="situation-live-badge">
            {t('web.dashboard.regionalSituation.liveLabel')}
          </span>
          {lastUpdated && (
            <span className="situation-panel__timestamp">
              {t('web.dashboard.regionalSituation.lastUpdated')}:{' '}
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      <SituationFiltersBar filters={filters} onFiltersChange={setFilters} />

      {loading && !data && (
        <div className="situation-panel__loading" data-testid="situation-loading">
          <div className="situation-panel__loading-spinner" />
          <p>{t('states.loading')}</p>
        </div>
      )}

      {error && (
        <div className="situation-panel__error" data-testid="situation-error">
          <span className="situation-panel__error-icon">⚠</span>
          <p>{t('states.error')}</p>
          <button
            onClick={fetchSituation}
            className="situation-panel__retry-button"
            data-testid="situation-retry"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {isEmpty && (
        <div className="situation-panel__empty" data-testid="situation-empty">
          <span className="situation-panel__empty-icon" aria-hidden>
            ◎
          </span>
          <p className="situation-panel__empty-title">
            {t('web.dashboard.regionalSituation.empty')}
          </p>
          <p className="situation-panel__empty-hint">
            {t('web.dashboard.regionalSituation.emptyHint')}
          </p>
        </div>
      )}

      {data && data.clusters.length > 0 && (
        <div className="situation-panel__grid" data-testid="situation-clusters">
          {data.clusters.map((cluster, idx) => (
            <SituationCard key={`${cluster.region}-${cluster.hazardType}-${idx}`} cluster={cluster} />
          ))}
        </div>
      )}
    </section>
  );
}
