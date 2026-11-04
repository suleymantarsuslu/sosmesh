import React from 'react';

import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { Icon } from '../../../../../features/cases/detail/icons';

type RegionArea = {
  osmId: string;
  name: string;
};

type Props = {
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  expiryHours: number;
  customExpiry: string;
  noRegionRestriction: boolean;
  selectedProvince: RegionArea | null;
  selectedDistrict: RegionArea | null;
  selectedNeighborhood: RegionArea | null;
  selectedStreet: RegionArea | null;
  provinces: RegionArea[];
  districts: RegionArea[];
  neighborhoods: RegionArea[];
  streets: RegionArea[];
  loadingProvinces: boolean;
  loadingDistricts: boolean;
  loadingNeighborhoods: boolean;
  loadingStreets: boolean;
  error: string | null;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSeverityChange: (value: 'info' | 'warning' | 'critical') => void;
  onExpiryChange: (hours: number) => void;
  onCustomExpiryChange: (value: string) => void;
  onNoRegionRestrictionChange: (value: boolean) => void;
  onProvinceChange: (value: RegionArea | null) => void;
  onDistrictChange: (value: RegionArea | null) => void;
  onNeighborhoodChange: (value: RegionArea | null) => void;
  onStreetChange: (value: RegionArea | null) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function BroadcastComposer({
  title,
  body,
  severity,
  expiryHours,
  customExpiry,
  noRegionRestriction,
  selectedProvince,
  selectedDistrict,
  selectedNeighborhood,
  selectedStreet,
  provinces,
  districts,
  neighborhoods,
  streets,
  loadingProvinces,
  loadingDistricts,
  loadingNeighborhoods,
  loadingStreets,
  error,
  onTitleChange,
  onBodyChange,
  onSeverityChange,
  onExpiryChange,
  onCustomExpiryChange,
  onNoRegionRestrictionChange,
  onProvinceChange,
  onDistrictChange,
  onNeighborhoodChange,
  onStreetChange,
  onSubmit,
}: Props) {
  const { t } = useOperatorPreferences();

  const charCount = body.length;
  const charLimit = 5000;

  const getSelectedRegionPreview = () => {
    const parts: string[] = [];
    if (selectedProvince) {
      parts.push(selectedProvince.name);
    }
    if (selectedDistrict) {
      parts.push(selectedDistrict.name);
    }
    if (selectedNeighborhood) {
      parts.push(selectedNeighborhood.name);
    }
    if (selectedStreet) {
      parts.push(selectedStreet.name);
    }
    return parts.join(' / ');
  };

  return (
    <section className="cd2-card broadcast-composer">
      <div className="cd2-card__header">
        <div className="cd2-card__icon">
          <Icon name="edit" size={16} />
        </div>
        <h2 className="cd2-card__title">{t('web.broadcasts.formTitle')}</h2>
      </div>

      <div className="cd2-card__body">
        {error && (
          <div className="broadcast-error">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="broadcast-form">
          <div className="broadcast-form__field">
            <label htmlFor="broadcast-title" className="broadcast-form__label">
              {t('web.broadcasts.notificationTitle')} *
            </label>
            <input
              id="broadcast-title"
              type="text"
              className="broadcast-form__input"
              maxLength={200}
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              required
            />
          </div>

          <div className="broadcast-form__field">
            <label htmlFor="broadcast-body" className="broadcast-form__label">
              {t('web.broadcasts.notificationBody')} *
            </label>
            <textarea
              id="broadcast-body"
              className="broadcast-form__textarea"
              rows={5}
              maxLength={5000}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              required
            />
            <div className="broadcast-char-count">
              {charCount} / {charLimit}
            </div>
          </div>

          <div className="broadcast-form__field">
            <label className="broadcast-form__label">
              {t('web.broadcasts.severity')} *
            </label>
            <div className="broadcast-severity-pills">
              <button
                type="button"
                className={`broadcast-severity-pill ${severity === 'info' ? 'is-active' : ''}`}
                data-severity="info"
                onClick={() => onSeverityChange('info')}
              >
                <Icon name="bell" size={14} />
                {t('web.broadcasts.severityInfo')}
              </button>
              <button
                type="button"
                className={`broadcast-severity-pill ${severity === 'warning' ? 'is-active' : ''}`}
                data-severity="warning"
                onClick={() => onSeverityChange('warning')}
              >
                <Icon name="alert" size={14} />
                {t('web.broadcasts.severityWarning')}
              </button>
              <button
                type="button"
                className={`broadcast-severity-pill ${severity === 'critical' ? 'is-active' : ''}`}
                data-severity="critical"
                onClick={() => onSeverityChange('critical')}
              >
                <Icon name="alert" size={14} />
                {t('web.broadcasts.severityCritical')}
              </button>
            </div>
          </div>

          <div className="broadcast-form__field">
            <label className="broadcast-form__label">
              {t('web.broadcasts.expiryHours')} *
            </label>
            <div className="broadcast-expiry-chips">
              <button
                type="button"
                className={`broadcast-expiry-chip ${expiryHours === 1 && !customExpiry ? 'is-active' : ''}`}
                onClick={() => onExpiryChange(1)}
              >
                1h
              </button>
              <button
                type="button"
                className={`broadcast-expiry-chip ${expiryHours === 6 && !customExpiry ? 'is-active' : ''}`}
                onClick={() => onExpiryChange(6)}
              >
                6h
              </button>
              <button
                type="button"
                className={`broadcast-expiry-chip ${expiryHours === 24 && !customExpiry ? 'is-active' : ''}`}
                onClick={() => onExpiryChange(24)}
              >
                24h
              </button>
              <button
                type="button"
                className={`broadcast-expiry-chip ${expiryHours === 72 && !customExpiry ? 'is-active' : ''}`}
                onClick={() => onExpiryChange(72)}
              >
                72h
              </button>
              <input
                type="number"
                className="broadcast-expiry-custom"
                placeholder={t('common.more')}
                min={1}
                max={168}
                value={customExpiry}
                onChange={(e) => {
                  onCustomExpiryChange(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    onExpiryChange(val);
                  }
                }}
              />
            </div>
          </div>

          <div className="broadcast-region-section">
            <div className="broadcast-region-toggle">
              <label className="broadcast-toggle-switch">
                <input
                  type="checkbox"
                  checked={noRegionRestriction}
                  onChange={(e) => onNoRegionRestrictionChange(e.target.checked)}
                />
                <span className="broadcast-toggle-slider" />
              </label>
              <div className="broadcast-toggle-label">
                <span className="broadcast-toggle-label__text">
                  {t('web.broadcasts.noRegionRestriction')}
                </span>
              </div>
            </div>

            {!noRegionRestriction && (
              <div className="broadcast-region-selectors">
                <div className="broadcast-region-title">
                  <Icon name="pin" size={14} />
                  <span>{t('web.broadcasts.selectRegion')}</span>
                </div>

                <div className="broadcast-region-row">
                  <div className="broadcast-form__field">
                    <label htmlFor="region-province" className="broadcast-form__label">
                      {t('web.broadcasts.province')} *
                    </label>
                    <div className="broadcast-select-wrapper">
                      <select
                        id="region-province"
                        className="broadcast-form__select"
                        value={selectedProvince?.osmId || ''}
                        onChange={(e) => {
                          const province = provinces.find((p) => p.osmId === e.target.value);
                          onProvinceChange(province || null);
                        }}
                        disabled={loadingProvinces}
                      >
                        <option value="">
                          {loadingProvinces ? t('web.broadcasts.loadingRegions') : t('web.broadcasts.selectProvince')}
                        </option>
                        {provinces.map((p) => (
                          <option key={p.osmId} value={p.osmId}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {loadingProvinces && (
                        <div className="broadcast-select-spinner">
                          <Icon name="refresh" size={14} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="broadcast-form__field">
                    <label htmlFor="region-district" className="broadcast-form__label">
                      {t('web.broadcasts.district')}
                    </label>
                    <div className="broadcast-select-wrapper">
                      <select
                        id="region-district"
                        className="broadcast-form__select"
                        value={selectedDistrict?.osmId || ''}
                        onChange={(e) => {
                          const district = districts.find((d) => d.osmId === e.target.value);
                          onDistrictChange(district || null);
                        }}
                        disabled={!selectedProvince || loadingDistricts}
                      >
                        <option value="">
                          {loadingDistricts ? t('web.broadcasts.loadingRegions') : t('web.broadcasts.selectDistrict')}
                        </option>
                        {districts.map((d) => (
                          <option key={d.osmId} value={d.osmId}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      {loadingDistricts && (
                        <div className="broadcast-select-spinner">
                          <Icon name="refresh" size={14} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="broadcast-region-row">
                  <div className="broadcast-form__field">
                    <label htmlFor="region-neighborhood" className="broadcast-form__label">
                      {t('web.broadcasts.neighborhood')}
                    </label>
                    <div className="broadcast-select-wrapper">
                      <select
                        id="region-neighborhood"
                        className="broadcast-form__select"
                        value={selectedNeighborhood?.osmId || ''}
                        onChange={(e) => {
                          const neighborhood = neighborhoods.find((n) => n.osmId === e.target.value);
                          onNeighborhoodChange(neighborhood || null);
                        }}
                        disabled={!selectedDistrict || loadingNeighborhoods}
                      >
                        <option value="">
                          {loadingNeighborhoods ? t('web.broadcasts.loadingRegions') : t('web.broadcasts.selectNeighborhood')}
                        </option>
                        {neighborhoods.map((n) => (
                          <option key={n.osmId} value={n.osmId}>
                            {n.name}
                          </option>
                        ))}
                      </select>
                      {loadingNeighborhoods && (
                        <div className="broadcast-select-spinner">
                          <Icon name="refresh" size={14} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="broadcast-form__field">
                    <label htmlFor="region-street" className="broadcast-form__label">
                      {t('web.broadcasts.street')}
                    </label>
                    <div className="broadcast-select-wrapper">
                      <select
                        id="region-street"
                        className="broadcast-form__select"
                        value={selectedStreet?.osmId || ''}
                        onChange={(e) => {
                          const street = streets.find((s) => s.osmId === e.target.value);
                          onStreetChange(street || null);
                        }}
                        disabled={!selectedNeighborhood || loadingStreets}
                      >
                        <option value="">
                          {loadingStreets ? t('web.broadcasts.loadingRegions') : t('web.broadcasts.selectStreet')}
                        </option>
                        {streets.map((s) => (
                          <option key={s.osmId} value={s.osmId}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {loadingStreets && (
                        <div className="broadcast-select-spinner">
                          <Icon name="refresh" size={14} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedProvince && (
                  <div className="broadcast-region-preview">
                    <Icon name="pin" size={12} />
                    <span>{getSelectedRegionPreview()}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="broadcast-form__actions">
            <button type="submit" className="cd2-btn cd2-btn--primary broadcast-submit-btn">
              <Icon name="check" size={16} />
              {t('web.broadcasts.confirmSend')}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
