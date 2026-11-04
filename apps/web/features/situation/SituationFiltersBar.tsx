'use client';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { SituationFilters } from './types';

type Props = {
  filters: SituationFilters;
  onFiltersChange: (filters: SituationFilters) => void;
};

export function SituationFiltersBar({ filters, onFiltersChange }: Props) {
  const { t } = useOperatorPreferences();

  const handleWindowChange = (hours: number) => {
    onFiltersChange({ ...filters, windowHours: hours });
  };

  const handleUrgencyChange = (urgency: string) => {
    onFiltersChange({
      ...filters,
      minUrgency: urgency === 'ALL' ? undefined : urgency,
    });
  };

  return (
    <div className="situation-filters" data-testid="situation-filters">
      <div className="situation-filters__group">
        <label className="situation-filters__label">
          {t('web.dashboard.regionalSituation.filters.timeWindow')}
        </label>
        <div className="situation-filters__buttons">
          <button
            className={`situation-filters__button ${filters.windowHours === 1 ? 'situation-filters__button--active' : ''}`}
            onClick={() => handleWindowChange(1)}
            data-testid="filter-1h"
          >
            {t('web.dashboard.regionalSituation.filters.window1h')}
          </button>
          <button
            className={`situation-filters__button ${filters.windowHours === 6 ? 'situation-filters__button--active' : ''}`}
            onClick={() => handleWindowChange(6)}
            data-testid="filter-6h"
          >
            {t('web.dashboard.regionalSituation.filters.window6h')}
          </button>
          <button
            className={`situation-filters__button ${filters.windowHours === 24 ? 'situation-filters__button--active' : ''}`}
            onClick={() => handleWindowChange(24)}
            data-testid="filter-24h"
          >
            {t('web.dashboard.regionalSituation.filters.window24h')}
          </button>
        </div>
      </div>

      <div className="situation-filters__group">
        <label className="situation-filters__label" htmlFor="min-urgency-select">
          {t('web.dashboard.regionalSituation.filters.minUrgency')}
        </label>
        <select
          id="min-urgency-select"
          className="situation-filters__select"
          value={filters.minUrgency ?? 'ALL'}
          onChange={(e) => handleUrgencyChange(e.target.value)}
          data-testid="filter-urgency"
        >
          <option value="ALL">—</option>
          <option value="LOW">{t('web.dashboard.regionalSituation.urgency.LOW')}</option>
          <option value="MEDIUM">{t('web.dashboard.regionalSituation.urgency.MEDIUM')}</option>
          <option value="HIGH">{t('web.dashboard.regionalSituation.urgency.HIGH')}</option>
          <option value="CRITICAL">{t('web.dashboard.regionalSituation.urgency.CRITICAL')}</option>
        </select>
      </div>
    </div>
  );
}
