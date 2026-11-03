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
            placeholder={t('web.cases.searchPlaceholder')}
            aria-label={t('web.cases.searchPlaceholder')}
            className="case-filters-toolbar__search-input"
            data-testid="case-filter-search"
          />
        </div>

        <div className="case-filters-toolbar__desktop-filters">
          <label className="case-filters-toolbar__filter">
            <span className="case-filters-toolbar__filter-label">{t('web.cases.tableHeaders.category')}</span>
            <select
              value={filters.category}
              onChange={(e) => onChange({ ...filters, category: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.cases.filterAll')}</option>
              <option value="GENERAL">{t('web.sos.button.label')}</option>
              <option value="MEDICAL">{t('web.teams.typeMedical')}</option>
              <option value="TRAPPED">{t('web.cases.detail')}</option>
              <option value="FIRE">{t('web.teams.typeFire')}</option>
              <option value="OTHER">{t('web.cases.detail')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__filter">
            <span className="case-filters-toolbar__filter-label">{t('web.cases.filterByStatus')}</span>
            <select
              value={filters.incidentState}
              onChange={(e) => onChange({ ...filters, incidentState: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.cases.filterAll')}</option>
              <option value="PENDING">{t('web.cases.statusPending')}</option>
              <option value="ASSIGNED">{t('web.teams.resourceTeam')}</option>
              <option value="IN_PROGRESS">{t('web.cases.statusInProgress')}</option>
              <option value="RESOLVED">{t('web.cases.statusResolved')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__filter">
            <span className="case-filters-toolbar__filter-label">{t('web.cases.tableHeaders.locationStatus')}</span>
            <select
              value={filters.locationStatus}
              onChange={(e) => onChange({ ...filters, locationStatus: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.cases.filterAll')}</option>
              <option value="GPS">GPS</option>
              <option value="MANUAL">{t('web.tasks.manual')}</option>
              <option value="UNKNOWN">{t('web.ai.urgencyUnknown')}</option>
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
          <span>{t('web.cases.filterByStatus')}</span>
          {activeFilterCount > 0 && (
            <span className="case-filters-toolbar__badge">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="case-filters-toolbar__mobile-panel">
          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.cases.tableHeaders.category')}</span>
            <select
              value={filters.category}
              onChange={(e) => onChange({ ...filters, category: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.cases.filterAll')}</option>
              <option value="GENERAL">{t('web.sos.button.label')}</option>
              <option value="MEDICAL">{t('web.teams.typeMedical')}</option>
              <option value="TRAPPED">{t('web.cases.detail')}</option>
              <option value="FIRE">{t('web.teams.typeFire')}</option>
              <option value="OTHER">{t('web.cases.detail')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.cases.filterByStatus')}</span>
            <select
              value={filters.incidentState}
              onChange={(e) => onChange({ ...filters, incidentState: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.cases.filterAll')}</option>
              <option value="PENDING">{t('web.cases.statusPending')}</option>
              <option value="ASSIGNED">{t('web.teams.resourceTeam')}</option>
              <option value="IN_PROGRESS">{t('web.cases.statusInProgress')}</option>
              <option value="RESOLVED">{t('web.cases.statusResolved')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.delivery.SERVER_ACCEPTED')}</span>
            <select
              value={filters.deliveryState}
              onChange={(e) => onChange({ ...filters, deliveryState: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.cases.filterAll')}</option>
              <option value="SERVER_ACCEPTED">{t('web.delivery.SERVER_ACCEPTED')}</option>
              <option value="OPERATOR_SEEN">{t('web.delivery.OPERATOR_SEEN')}</option>
              <option value="CASE_IN_PROGRESS">{t('web.delivery.CASE_IN_PROGRESS')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.cases.tableHeaders.locationStatus')}</span>
            <select
              value={filters.locationStatus}
              onChange={(e) => onChange({ ...filters, locationStatus: e.target.value })}
              className="case-filters-toolbar__select"
            >
              <option value="">{t('web.cases.filterAll')}</option>
              <option value="GPS">GPS</option>
              <option value="MANUAL">{t('web.tasks.manual')}</option>
              <option value="UNKNOWN">{t('web.ai.urgencyUnknown')}</option>
            </select>
          </label>

          <label className="case-filters-toolbar__mobile-filter">
            <span className="case-filters-toolbar__filter-label">{t('web.cases.tableHeaders.accuracy')}</span>
            <input
              type="number"
              min={0}
              value={filters.accuracyMax}
              onChange={(e) => onChange({ ...filters, accuracyMax: e.target.value })}
              placeholder="Max (m)"
              className="case-filters-toolbar__input"
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
