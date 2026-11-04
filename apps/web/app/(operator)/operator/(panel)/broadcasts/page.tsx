'use client';

import React, { useState, useEffect } from 'react';

import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { Icon } from '../../../../../features/cases/detail/icons';
import { OpsHeader, OpsState, OpsChip } from '../../../../../features/ops/OpsPrimitives';

type RegionArea = {
  osmId: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  boundingBox: [number, number, number, number];
};

type BroadcastHistory = {
  id: string;
  title: string;
  severity: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  hasRegion: boolean;
  regionLabel?: string;
  deliveredCount: number;
  meshRelayCount: number;
};

export default function BroadcastsPage() {
  const { t, locale } = useOperatorPreferences();
  const brandName = locale === 'tr' ? 'Acil Durum Ağı' : 'SOSMesh';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [expiryHours, setExpiryHours] = useState(24);
  const [noRegionRestriction, setNoRegionRestriction] = useState(true);

  const [selectedCountry, setSelectedCountry] = useState<RegionArea | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<RegionArea | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<RegionArea | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<RegionArea | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<RegionArea | null>(null);

  const [countries, setCountries] = useState<RegionArea[]>([]);
  const [provinces, setProvinces] = useState<RegionArea[]>([]);
  const [districts, setDistricts] = useState<RegionArea[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<RegionArea[]>([]);
  const [streets, setStreets] = useState<RegionArea[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);
  const [loadingStreets, setLoadingStreets] = useState(false);

  const [neighborhoodsError, setNeighborhoodsError] = useState<{ messageEN: string; messageTR: string } | null>(null);
  const [streetsError, setStreetsError] = useState<{ messageEN: string; messageTR: string } | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCountries();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      fetchProvinces(selectedCountry.osmId);
    } else {
      setProvinces([]);
      setSelectedProvince(null);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedProvince) {
      fetchDistricts(selectedProvince.osmId);
    } else {
      setDistricts([]);
      setSelectedDistrict(null);
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedDistrict) {
      fetchNeighborhoods(selectedDistrict.osmId);
    } else {
      setNeighborhoods([]);
      setSelectedNeighborhood(null);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedNeighborhood) {
      fetchStreets(selectedNeighborhood.osmId);
    } else {
      setStreets([]);
      setSelectedStreet(null);
    }
  }, [selectedNeighborhood]);

  const fetchCountries = async () => {
    try {
      const res = await fetch('/api/operator/broadcasts/regions/countries');
      if (res.ok) {
        const data = await res.json();
        setCountries(data);
        if (data.length > 0) {
          setSelectedCountry(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch countries', err);
    }
  };

  const fetchProvinces = async (countryOsmId: string) => {
    setLoadingProvinces(true);
    try {
      const res = await fetch(`/api/operator/broadcasts/regions/provinces?countryOsmId=${encodeURIComponent(countryOsmId)}`);
      if (res.ok) {
        const data = await res.json();
        setProvinces(data);
      }
    } catch (err) {
      console.error('Failed to fetch provinces', err);
    } finally {
      setLoadingProvinces(false);
    }
  };

  const fetchDistricts = async (provinceOsmId: string) => {
    setLoadingDistricts(true);
    try {
      const res = await fetch(`/api/operator/broadcasts/regions/districts?provinceOsmId=${encodeURIComponent(provinceOsmId)}`);
      if (res.ok) {
        const data = await res.json();
        setDistricts(data);
      }
    } catch (err) {
      console.error('Failed to fetch districts', err);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const fetchNeighborhoods = async (districtOsmId: string) => {
    setLoadingNeighborhoods(true);
    setNeighborhoodsError(null);
    setNeighborhoods([]);
    try {
      const res = await fetch(`/api/operator/broadcasts/regions/neighborhoods?districtOsmId=${encodeURIComponent(districtOsmId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setNeighborhoodsError(data.error);
        } else {
          setNeighborhoods(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch neighborhoods', err);
      setNeighborhoodsError({
        messageEN: 'Network error. Please try again.',
        messageTR: 'Ağ hatası. Lütfen tekrar deneyin.',
      });
    } finally {
      setLoadingNeighborhoods(false);
    }
  };

  const fetchStreets = async (neighborhoodOsmId: string) => {
    setLoadingStreets(true);
    setStreetsError(null);
    setStreets([]);
    try {
      const res = await fetch(`/api/operator/broadcasts/regions/streets?neighborhoodOsmId=${encodeURIComponent(neighborhoodOsmId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setStreetsError(data.error);
        } else {
          setStreets(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch streets', err);
      setStreetsError({
        messageEN: 'Network error. Please try again.',
        messageTR: 'Ağ hatası. Lütfen tekrar deneyin.',
      });
    } finally {
      setLoadingStreets(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/operator/broadcasts/history?limit=50');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) {
      setError(t('web.broadcasts.validationTitleRequired'));
      return;
    }
    setShowConfirm(true);
  };

  const confirmSend = async () => {
    setLoading(true);
    setError(null);
    try {
      type CreateBroadcastDto = {
        title: string;
        body: string;
        severity: string;
        expiryHours: number;
        selectedRegion?: {
          label: string;
          lat: number;
          lon: number;
          boundingBox: [number, number, number, number];
        };
      };

      const dto: CreateBroadcastDto = {
        title,
        body,
        severity,
        expiryHours,
      };

      if (!noRegionRestriction) {
        const region = selectedStreet || selectedNeighborhood || selectedDistrict || selectedProvince;
        if (!region) {
          throw new Error('No region selected');
        }
        const parts: string[] = [];
        if (selectedCountry && selectedCountry.osmId === 'relation/174737') {
          parts.push('Türkiye');
        }
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
        
        dto.selectedRegion = {
          label: parts.join(' / '),
          lat: region.lat,
          lon: region.lon,
          boundingBox: region.boundingBox,
        };
      }

      const res = await fetch('/api/operator/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });

      if (!res.ok) {
        throw new Error('Failed to send broadcast');
      }

      setTitle('');
      setBody('');
      setSeverity('info');
      setExpiryHours(24);
      setNoRegionRestriction(true);
      setSelectedCountry(countries[0] || null);
      setSelectedProvince(null);
      setSelectedDistrict(null);
      setSelectedNeighborhood(null);
      setSelectedStreet(null);
      setShowConfirm(false);
      await fetchHistory();
      alert(t('web.broadcasts.sendSuccess'));
    } catch (err) {
      setError(t('web.broadcasts.sendError'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedRegionLabel = () => {
    const parts: string[] = [];
    if (selectedCountry && selectedCountry.osmId === 'relation/174737') {
      parts.push('Türkiye');
    }
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

  const getSeverityTone = (sev: string): 'ok' | 'warn' | 'danger' | 'info' | 'muted' | 'ai' => {
    switch (sev) {
      case 'critical': return 'danger';
      case 'warning': return 'warn';
      default: return 'info';
    }
  };

  return (
    <div className="cd2 ops-page broadcasts-page">
      <OpsHeader
        icon="bell"
        title={t('web.broadcasts.title')}
        subtitle={t('web.broadcasts.subtitle').replace('SOSMesh', brandName).replace('Acil Durum Ağı', brandName)}
      />

      <div className="broadcasts-page__content">
        <section className="cd2-card broadcasts-form-card">
          <h2 className="cd2-card__title">
            <Icon name="edit" size={18} />
            {t('web.broadcasts.formTitle')}
          </h2>
          {error && <div className="cd2-alert cd2-alert--error">{error}</div>}
          <form onSubmit={handleSubmit} className="cd2-form">
            <div className="cd2-form__field">
              <label htmlFor="broadcast-title" className="cd2-label">
                {t('web.broadcasts.notificationTitle')} *
              </label>
              <input
                id="broadcast-title"
                type="text"
                className="cd2-input"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="cd2-form__field">
              <label htmlFor="broadcast-body" className="cd2-label">
                {t('web.broadcasts.notificationBody')} *
              </label>
              <textarea
                id="broadcast-body"
                className="cd2-textarea"
                rows={5}
                maxLength={5000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            <div className="cd2-form__row">
              <div className="cd2-form__field">
                <label htmlFor="broadcast-severity" className="cd2-label">
                  {t('web.broadcasts.severity')} *
                </label>
                <select
                  id="broadcast-severity"
                  className="cd2-select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as 'info' | 'warning' | 'critical')}
                >
                  <option value="info">{t('web.broadcasts.severityInfo')}</option>
                  <option value="warning">{t('web.broadcasts.severityWarning')}</option>
                  <option value="critical">{t('web.broadcasts.severityCritical')}</option>
                </select>
              </div>

              <div className="cd2-form__field">
                <label htmlFor="broadcast-expiry" className="cd2-label">
                  {t('web.broadcasts.expiryHours')} *
                </label>
                <input
                  id="broadcast-expiry"
                  type="number"
                  className="cd2-input"
                  min={1}
                  max={168}
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(parseInt(e.target.value, 10))}
                  required
                />
              </div>
            </div>

            <div className="cd2-form__field">
              <label className="cd2-checkbox">
                <input
                  type="checkbox"
                  checked={noRegionRestriction}
                  onChange={(e) => setNoRegionRestriction(e.target.checked)}
                />
                <span>{t('web.broadcasts.noRegionRestriction')}</span>
              </label>
            </div>

            {!noRegionRestriction && (
              <div className="broadcast-region-selector">
                <h3 className="broadcast-region-selector__title">
                  <Icon name="pin" size={16} />
                  {t('web.broadcasts.selectRegion')}
                </h3>

                <div className="cd2-form__row">
                  <div className="cd2-form__field">
                    <label htmlFor="region-province" className="cd2-label">
                      {t('web.broadcasts.province')} *
                      {loadingProvinces && <span className="cd2-spinner cd2-spinner--sm" />}
                    </label>
                    <select
                      id="region-province"
                      className="cd2-select"
                      value={selectedProvince?.osmId || ''}
                      onChange={(e) => {
                        const province = provinces.find((p) => p.osmId === e.target.value);
                        setSelectedProvince(province || null);
                        setSelectedDistrict(null);
                        setSelectedNeighborhood(null);
                        setSelectedStreet(null);
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
                  </div>

                  <div className="cd2-form__field">
                    <label htmlFor="region-district" className="cd2-label">
                      {t('web.broadcasts.district')}
                      {loadingDistricts && <span className="cd2-spinner cd2-spinner--sm" />}
                    </label>
                    <select
                      id="region-district"
                      className="cd2-select"
                      value={selectedDistrict?.osmId || ''}
                      onChange={(e) => {
                        const district = districts.find((d) => d.osmId === e.target.value);
                        setSelectedDistrict(district || null);
                        setSelectedNeighborhood(null);
                        setSelectedStreet(null);
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
                  </div>
                </div>

                <div className="cd2-form__row">
                  <div className="cd2-form__field">
                    <label htmlFor="region-neighborhood" className="cd2-label">
                      {t('web.broadcasts.neighborhood')}
                      {loadingNeighborhoods && <span className="cd2-spinner cd2-spinner--sm" />}
                    </label>
                    {neighborhoodsError ? (
                      <div className="cd2-alert cd2-alert--error" style={{ marginTop: '0.5rem' }}>
                        <p>{locale === 'tr' ? neighborhoodsError.messageTR : neighborhoodsError.messageEN}</p>
                        <button
                          type="button"
                          className="cd2-btn cd2-btn--sm cd2-btn--ghost"
                          onClick={() => selectedDistrict && fetchNeighborhoods(selectedDistrict.osmId)}
                          style={{ marginTop: '0.5rem' }}
                        >
                          <Icon name="refresh" size={14} />
                          {locale === 'tr' ? 'Tekrar Dene' : 'Retry'}
                        </button>
                      </div>
                    ) : (
                      <select
                        id="region-neighborhood"
                        className="cd2-select"
                        value={selectedNeighborhood?.osmId || ''}
                        onChange={(e) => {
                          const neighborhood = neighborhoods.find((n) => n.osmId === e.target.value);
                          setSelectedNeighborhood(neighborhood || null);
                          setSelectedStreet(null);
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
                    )}
                  </div>

                  <div className="cd2-form__field">
                    <label htmlFor="region-street" className="cd2-label">
                      {t('web.broadcasts.street')}
                      {loadingStreets && <span className="cd2-spinner cd2-spinner--sm" />}
                    </label>
                    {streetsError ? (
                      <div className="cd2-alert cd2-alert--error" style={{ marginTop: '0.5rem' }}>
                        <p>{locale === 'tr' ? streetsError.messageTR : streetsError.messageEN}</p>
                        <button
                          type="button"
                          className="cd2-btn cd2-btn--sm cd2-btn--ghost"
                          onClick={() => selectedNeighborhood && fetchStreets(selectedNeighborhood.osmId)}
                          style={{ marginTop: '0.5rem' }}
                        >
                          <Icon name="refresh" size={14} />
                          {locale === 'tr' ? 'Tekrar Dene' : 'Retry'}
                        </button>
                      </div>
                    ) : (
                      <select
                        id="region-street"
                        className="cd2-select"
                        value={selectedStreet?.osmId || ''}
                        onChange={(e) => {
                          const street = streets.find((s) => s.osmId === e.target.value);
                          setSelectedStreet(street || null);
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
                    )}
                  </div>
                </div>

                {selectedProvince && (
                  <div className="broadcast-region-preview">
                    <Icon name="pin" size={14} />
                    <span>{getSelectedRegionLabel()}</span>
                  </div>
                )}
              </div>
            )}

            <div className="cd2-form__actions">
              <button type="submit" className="cd2-btn cd2-btn--primary" disabled={loading}>
                <Icon name="check" size={16} />
                {t('web.broadcasts.confirmSend')}
              </button>
            </div>
          </form>
        </section>

        <section className="cd2-card broadcasts-history-card">
          <div className="cd2-card__header">
            <h2 className="cd2-card__title">
              <Icon name="clock" size={18} />
              {t('web.broadcasts.historyTitle')}
            </h2>
            <button
              type="button"
              className="cd2-btn cd2-btn--sm cd2-btn--ghost"
              onClick={fetchHistory}
              disabled={historyLoading}
            >
              <Icon name="refresh" size={14} />
              {t('common.refresh')}
            </button>
          </div>

          <OpsState 
            state={historyLoading ? 'loading' : history.length === 0 ? 'empty' : 'idle'} 
            icon="tasks"
            emptyTitle={t('web.broadcasts.emptyState')}
            emptyHint={t('web.broadcasts.emptyStateHint')}
          >
            <ul className="broadcasts-history-list">
              {history.map((item) => (
                <li key={item.id} className="broadcast-history-item">
                  <div className="broadcast-history-item__header">
                    <h3 className="broadcast-history-item__title">{item.title}</h3>
                    <OpsChip tone={getSeverityTone(item.severity)} icon="alert">
                      {t(`web.broadcasts.severity${item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}`)}
                    </OpsChip>
                  </div>
                  <div className="broadcast-history-item__meta">
                    <span className="ops-meta-item">
                      <Icon name="user" size={13} />
                      {item.createdBy}
                    </span>
                    <span className="ops-meta-item">
                      <Icon name="clock" size={13} />
                      {new Date(item.createdAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                    </span>
                    <span className="ops-meta-item">
                      <Icon name="pin" size={13} />
                      {item.regionLabel || t('web.broadcasts.historyTargetAll')}
                    </span>
                  </div>
                  <div className="broadcast-history-item__stats">
                    <span className="broadcast-stat">
                      <Icon name="check" size={13} />
                      {t('web.broadcasts.historyDelivered')}: {item.deliveredCount}
                    </span>
                    <span className="broadcast-stat">
                      <Icon name="users" size={13} />
                      {t('web.broadcasts.historyMeshRelayed')}: {item.meshRelayCount}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </OpsState>
        </section>
      </div>

      {showConfirm && (
        <div className="cd2-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="cd2-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cd2-modal__header">
              <h3 className="cd2-modal__title">{t('web.broadcasts.confirmTitle')}</h3>
              <button
                type="button"
                className="cd2-modal__close"
                onClick={() => setShowConfirm(false)}
                aria-label={t('common.close')}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="cd2-modal__body">
              <p>
                {noRegionRestriction
                  ? t('web.broadcasts.confirmBodyAll')
                  : t('web.broadcasts.confirmBodyRegion').replace('{{region}}', getSelectedRegionLabel())}
              </p>
            </div>
            <div className="cd2-modal__actions">
              <button
                type="button"
                className="cd2-btn cd2-btn--primary"
                onClick={confirmSend}
                disabled={loading}
              >
                <Icon name="check" size={16} />
                {t('web.broadcasts.confirmSend')}
              </button>
              <button
                type="button"
                className="cd2-btn cd2-btn--ghost"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                {t('web.broadcasts.confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
