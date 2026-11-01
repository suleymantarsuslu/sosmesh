import type { CaseFiltersState, OperatorCaseRow } from './types';

export function applyCaseFilters(
  rows: OperatorCaseRow[],
  filters: CaseFiltersState
): OperatorCaseRow[] {
  const search = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (search) {
      const haystack = `${row.incidentId} ${row.messageId} ${row.sosType}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    if (filters.category && row.sosType !== filters.category) {
      return false;
    }
    if (filters.incidentState && row.incidentState !== filters.incidentState) {
      return false;
    }
    if (filters.deliveryState && row.deliveryState !== filters.deliveryState) {
      return false;
    }
    if (filters.locationStatus && row.locationStatus !== filters.locationStatus) {
      return false;
    }
    if (filters.source && (row.source ?? '').toLowerCase() !== filters.source.toLowerCase()) {
      return false;
    }
    if (filters.accuracyMax) {
      const max = Number(filters.accuracyMax);
      if (Number.isFinite(max)) {
        const acc = row.accuracyMeters;
        if (acc == null || acc > max) {
          return false;
        }
      }
    }
    return true;
  });
}

export function defaultCaseFilters(): CaseFiltersState {
  return {
    search: '',
    category: '',
    incidentState: '',
    deliveryState: '',
    locationStatus: '',
    source: '',
    accuracyMax: '',
  };
}
