'use client';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { CaseFiltersState } from './types';

type Props = {
  filters: CaseFiltersState;
  onChange: (next: CaseFiltersState) => void;
};

export function CaseFilters({ filters, onChange }: Props) {
  const { t } = useOperatorPreferences();

  return (
    <fieldset className="case-filters" data-testid="case-filters">
      <legend className="case-filters__legend">{t('web.filters.legend')}</legend>
      <label>
        {t('web.filters.search')}
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder={t('web.filters.searchPlaceholder')}
          aria-label={t('web.filters.searchAriaLabel')}
          data-testid="case-filter-search"
        />
      </label>
      <label>
        {t('web.filters.category')}
        <select
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
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
      <label>
        {t('web.filters.incidentState')}
        <select
          value={filters.incidentState}
          onChange={(e) => onChange({ ...filters, incidentState: e.target.value })}
          aria-label={t('web.filters.incidentStateAriaLabel')}
        >
          <option value="">{t('web.filters.all')}</option>
          <option value="PENDING">{t('web.incidentStates.PENDING')}</option>
          <option value="ASSIGNED">{t('web.incidentStates.ASSIGNED')}</option>
          <option value="IN_PROGRESS">{t('web.incidentStates.IN_PROGRESS')}</option>
          <option value="RESOLVED">{t('web.incidentStates.RESOLVED')}</option>
        </select>
      </label>
      <label>
        {t('web.filters.deliveryState')}
        <select
          value={filters.deliveryState}
          onChange={(e) => onChange({ ...filters, deliveryState: e.target.value })}
          aria-label={t('web.filters.deliveryStateAriaLabel')}
        >
          <option value="">{t('web.filters.all')}</option>
          <option value="SERVER_ACCEPTED">{t('web.delivery.SERVER_ACCEPTED')}</option>
          <option value="OPERATOR_SEEN">{t('web.delivery.OPERATOR_SEEN')}</option>
          <option value="CASE_IN_PROGRESS">{t('web.delivery.CASE_IN_PROGRESS')}</option>
        </select>
      </label>
      <label>
        {t('web.filters.locationStatus')}
        <select
          value={filters.locationStatus}
          onChange={(e) => onChange({ ...filters, locationStatus: e.target.value })}
          aria-label={t('web.filters.locationStatusAriaLabel')}
        >
          <option value="">{t('web.filters.all')}</option>
          <option value="GPS">{t('web.locationStatuses.GPS')}</option>
          <option value="MANUAL">{t('web.locationStatuses.MANUAL')}</option>
          <option value="UNKNOWN">{t('web.locationStatuses.UNKNOWN')}</option>
        </select>
      </label>
      <label>
        {t('web.filters.accuracyMax')}
        <input
          type="number"
          min={0}
          value={filters.accuracyMax}
          onChange={(e) => onChange({ ...filters, accuracyMax: e.target.value })}
          aria-label={t('web.filters.accuracyMaxAriaLabel')}
        />
      </label>
    </fieldset>
  );
}
