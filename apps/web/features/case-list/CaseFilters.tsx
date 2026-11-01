'use client';

import type { CaseFiltersState } from './types';

type Props = {
  filters: CaseFiltersState;
  onChange: (next: CaseFiltersState) => void;
};

export function CaseFilters({ filters, onChange }: Props) {
  return (
    <fieldset className="case-filters" data-testid="case-filters">
      <legend className="case-filters__legend">Filtreler</legend>
      <label>
        Ara
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          aria-label="Vaka ara"
          data-testid="case-filter-search"
        />
      </label>
      <label>
        Kategori
        <select
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
          aria-label="Kategori filtresi"
        >
          <option value="">Tümü</option>
          <option value="GENERAL">Genel</option>
          <option value="MEDICAL">Tıbbi</option>
          <option value="TRAPPED">Enkaz</option>
          <option value="FIRE">Yangın</option>
          <option value="OTHER">Diğer</option>
        </select>
      </label>
      <label>
        Vaka durumu
        <select
          value={filters.incidentState}
          onChange={(e) => onChange({ ...filters, incidentState: e.target.value })}
          aria-label="Vaka durumu filtresi"
        >
          <option value="">Tümü</option>
          <option value="PENDING">Beklemede</option>
          <option value="ASSIGNED">Atandı</option>
          <option value="IN_PROGRESS">Devam ediyor</option>
          <option value="RESOLVED">Çözüldü</option>
        </select>
      </label>
      <label>
        Teslim durumu
        <select
          value={filters.deliveryState}
          onChange={(e) => onChange({ ...filters, deliveryState: e.target.value })}
          aria-label="Teslim durumu filtresi"
        >
          <option value="">Tümü</option>
          <option value="SERVER_ACCEPTED">Sunucu kabul</option>
          <option value="OPERATOR_SEEN">Operatör gördü</option>
          <option value="CASE_IN_PROGRESS">İşlemde</option>
        </select>
      </label>
      <label>
        Konum
        <select
          value={filters.locationStatus}
          onChange={(e) => onChange({ ...filters, locationStatus: e.target.value })}
          aria-label="Konum durumu filtresi"
        >
          <option value="">Tümü</option>
          <option value="GPS">GPS</option>
          <option value="MANUAL">Manuel</option>
          <option value="UNKNOWN">Bilinmiyor</option>
        </select>
      </label>
      <label>
        Doğruluk ≤ (m)
        <input
          type="number"
          min={0}
          value={filters.accuracyMax}
          onChange={(e) => onChange({ ...filters, accuracyMax: e.target.value })}
          aria-label="Maksimum doğruluk metresi"
        />
      </label>
    </fieldset>
  );
}
