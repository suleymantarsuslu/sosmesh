'use client';

import { useState, useMemo } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { CaseFiltersState } from './types';
import { defaultCaseFilters } from './filter-cases';

type Props = {
  filters: CaseFiltersState;
  onChange: (next: CaseFiltersState) => void;
};

export function CaseFilters({ filters, onChange }: Props) {
  const { t } = useOperatorPreferences();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilterCount = useMemo(() => {
    const defaults = defaultCaseFilters();
    let count = 0;
    if (filters.category !== defaults.category) count++;
    if (filters.incidentState !== defaults.incidentState) count++;
    if (filters.deliveryState !== defaults.deliveryState) count++;
    if (filters.locationStatus !== defaults.locationStatus) count++;
    if (filters.accuracyMax !== defaults.accuracyMax) count++;
    if (filters.search !== defaults.search) count++;
    return count;
  }, [filters]);

  const clearFilters = () => {
    onChange(defaultCaseFilters());
  };

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="case-filters-toolbar" data-testid="case-filters">
      <div className="case-filters-toolbar__main">
        <div className="case-filters-toolbar__search">
          <span className="case-filters-toolbar__search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder={t('web.filters.searchPlaceholder')}
            aria-label={t('web.filters.searchAriaLabel')}
            className="case-filters-toolbar__search-input"
            data-testid="case-filter-search"
          />
        </div>

        <div className="case-filters-toolbar__desktop-filters">
          <label className="case-filters-toolbar__filter">
            <span className="case-filters-toolbar__filter-label">{t('web.filters.category')}</span>
            <select
              value={filters.category}
              onChange={(e) => onChange({ ...filters, category: e.target.value })}
              className="case-filters-toolbar__select"
              aria-label={t('web.filters.categoryAriaLabel')}
            >
              <option value="">{t('web.filters.all')}</option>
              <option value="GENERAL">{t('web.categoryTypes.GENERAL')}</option>
              <option value="MEDICAL">{t('web.categoryTypes.MEDICAL')}</option>
              <option value="TRAPPED">{t('web.categoryTypes.TRAPPED')}</option>
              <option value="FIRE">{t('web.categoryTypes.FIRE')}</option>
              <option value="OTHER">{t('web.categoryTypes.OTHER')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__filter">
            <span className="case-filters-toolbar__filter-label">{t('web.filters.incidentState')}</span>
            <select
              value={filters.incidentState}
              onChange={(e) => onChange({ ...filters, incidentState: e.target.value })}
              className="case-filters-toolbar__select"
              aria-label={t('web.filters.incidentStateAriaLabel')}
            >
              <option value="">{t('web.filters.all')}</option>
              <option value="PENDING">{t('web.incidentStates.PENDING')}</option>
              <option value="ASSIGNED">{t('web.incidentStates.ASSIGNED')}</option>
              <option value="IN_PROGRESS">{t('web.incidentStates.IN_PROGRESS')}</option>
              <option value="RESOLVED">{t('web.incidentStates.RESOLVED')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__filter">
            <span className="case-filters-toolbar__filter-label">{t('web.filters.locationStatus')}</span>
            <select
              value={filters.locationStatus}
              onChange={(e) => onChange({ ...filters, locationStatus: e.target.value })}
              className="case-filters-toolbar__select"
              aria-label={t('web.filters.locationStatusAriaLabel')}
            >
              <option value="">{t('web.filters.all')}</option>
              <option value="GPS">{t('web.locationStatuses.GPS')}</option>
              <option value="MANUAL">{t('web.locationStatuses.MANUAL')}</option>
              <option value="UNKNOWN">{t('web.locationStatuses.UNKNOWN')}</option>
            </select>
          </label>

          {filters.accuracyMax && (
            <div className="case-filters-toolbar__chip">
              <span>≤ {filters.accuracyMax}m</span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, accuracyMax: '' })}
                aria-label="Clear accuracy filter"
                className="case-filters-toolbar__chip-remove"
              >
                ×
              </button>
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="case-filters-toolbar__clear"
            >
              {t('web.common.cancel')} {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="case-filters-toolbar__mobile-toggle"
          aria-expanded={isExpanded}
        >
          <span className="case-filters-toolbar__mobile-toggle-icon" aria-hidden="true">⚙</span>
          <span>{t('web.filters.legend')}</span>
          {activeFilterCount > 0 && (
            <span className="case-filters-toolbar__badge">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="case-filters-toolbar__mobile-panel">
          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.filters.category')}</span>
            <select
              value={filters.category}
              onChange={(e) => onChange({ ...filters, category: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.filters.all')}</option>
              <option value="GENERAL">{t('web.categoryTypes.GENERAL')}</option>
              <option value="MEDICAL">{t('web.categoryTypes.MEDICAL')}</option>
              <option value="TRAPPED">{t('web.categoryTypes.TRAPPED')}</option>
              <option value="FIRE">{t('web.categoryTypes.FIRE')}</option>
              <option value="OTHER">{t('web.categoryTypes.OTHER')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.filters.incidentState')}</span>
            <select
              value={filters.incidentState}
              onChange={(e) => onChange({ ...filters, incidentState: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.filters.all')}</option>
              <option value="PENDING">{t('web.incidentStates.PENDING')}</option>
              <option value="ASSIGNED">{t('web.incidentStates.ASSIGNED')}</option>
              <option value="IN_PROGRESS">{t('web.incidentStates.IN_PROGRESS')}</option>
              <option value="RESOLVED">{t('web.incidentStates.RESOLVED')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.filters.deliveryState')}</span>
            <select
              value={filters.deliveryState}
              onChange={(e) => onChange({ ...filters, deliveryState: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.filters.all')}</option>
              <option value="SERVER_ACCEPTED">{t('web.delivery.SERVER_ACCEPTED')}</option>
              <option value="OPERATOR_SEEN">{t('web.delivery.OPERATOR_SEEN')}</option>
              <option value="CASE_IN_PROGRESS">{t('web.delivery.CASE_IN_PROGRESS')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.filters.locationStatus')}</span>
            <select
              value={filters.locationStatus}
              onChange={(e) => onChange({ ...filters, locationStatus: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.filters.all')}</option>
              <option value="GPS">{t('web.locationStatuses.GPS')}</option>
              <option value="MANUAL">{t('web.locationStatuses.MANUAL')}</option>
              <option value="UNKNOWN">{t('web.locationStatuses.UNKNOWN')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.filters.accuracyMax')}</span>
            <input
              type="number"
              min={0}
              value={filters.accuracyMax}
              onChange={(e) => onChange({ ...filters, accuracyMax: e.target.value })}
              placeholder="Max (m)"
              className="case-filters-toolbar__input"
              aria-label={t('web.filters.accuracyMaxAriaLabel')}
            />
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="case-filters-toolbar__clear case-filters-toolbar__clear--mobile"
            >
              {t('web.common.cancel')} ({activeFilterCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
