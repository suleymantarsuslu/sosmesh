'use client';

import React, { useState, useEffect } from 'react';

import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { Icon } from '../../../../../features/cases/detail/icons';
import { OpsHeader } from '../../../../../features/ops/OpsPrimitives';

import { BroadcastComposer } from './BroadcastComposer';
import { BroadcastHistory } from './BroadcastHistory';
import { BroadcastPreview } from './BroadcastPreview';
import { ConfirmBroadcastModal } from './ConfirmBroadcastModal';

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
  body: string;
  severity: string;
  kind: string;
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

  const [broadcastKind, setBroadcastKind] = useState<'standard' | 'relay_request'>('standard');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [expiryHours, setExpiryHours] = useState(24);
  const [customExpiry, setCustomExpiry] = useState('');
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
  const [success, setSuccess] = useState(false);

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

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

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
      // Silent fail for regions
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
      // Silent fail
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
      // Silent fail
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
      // Silent fail
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError(t('web.broadcasts.validationTitleRequired'));
      return;
    }
    setError(null);
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
        kind?: string;
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
        kind: broadcastKind,
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

      setBroadcastKind('standard');
      setTitle('');
      setBody('');
      setSeverity('info');
      setExpiryHours(24);
      setCustomExpiry('');
      setNoRegionRestriction(true);
      setSelectedCountry(countries[0] || null);
      setSelectedProvince(null);
      setSelectedDistrict(null);
      setSelectedNeighborhood(null);
      setSelectedStreet(null);
      setShowConfirm(false);
      await fetchHistory();
      setSuccess(true);
    } catch (err) {
      setError(t('web.broadcasts.sendError'));
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
    return parts.join(' / ') || (locale === 'tr' ? 'Tüm cihazlar' : 'All devices');
  };

  return (
    <div className="cd2 ops-page broadcasts-page">
      <OpsHeader
        icon="bell"
        title={t('web.broadcasts.title')}
        subtitle={t('web.broadcasts.subtitle').replace('SOSMesh', brandName).replace('Acil Durum Ağı', brandName)}
      />

      {success && (
        <div className="broadcast-success-toast">
          <Icon name="check" size={16} />
          <span>{t('web.broadcasts.sendSuccess')}</span>
        </div>
      )}

      <div className="broadcast-layout">
        <div className="broadcast-layout__main">
          <BroadcastComposer
            broadcastKind={broadcastKind}
            title={title}
            body={body}
            severity={severity}
            expiryHours={expiryHours}
            customExpiry={customExpiry}
            noRegionRestriction={noRegionRestriction}
            selectedProvince={selectedProvince}
            selectedDistrict={selectedDistrict}
            selectedNeighborhood={selectedNeighborhood}
            selectedStreet={selectedStreet}
            provinces={provinces}
            districts={districts}
            neighborhoods={neighborhoods}
            streets={streets}
            loadingProvinces={loadingProvinces}
            loadingDistricts={loadingDistricts}
            loadingNeighborhoods={loadingNeighborhoods}
            loadingStreets={loadingStreets}
            neighborhoodsError={neighborhoodsError}
            streetsError={streetsError}
            error={error}
            onBroadcastKindChange={setBroadcastKind}
            onTitleChange={setTitle}
            onBodyChange={setBody}
            onSeverityChange={setSeverity}
            onExpiryChange={(hours) => {
              setExpiryHours(hours);
              setCustomExpiry('');
            }}
            onCustomExpiryChange={setCustomExpiry}
            onNoRegionRestrictionChange={setNoRegionRestriction}
            onProvinceChange={(p) => {
              setSelectedProvince(p);
              setSelectedDistrict(null);
              setSelectedNeighborhood(null);
              setSelectedStreet(null);
            }}
            onDistrictChange={(d) => {
              setSelectedDistrict(d);
              setSelectedNeighborhood(null);
              setSelectedStreet(null);
            }}
            onNeighborhoodChange={(n) => {
              setSelectedNeighborhood(n);
              setSelectedStreet(null);
            }}
            onStreetChange={setSelectedStreet}
            onRetryNeighborhoods={() => selectedDistrict && fetchNeighborhoods(selectedDistrict.osmId)}
            onRetryStreets={() => selectedNeighborhood && fetchStreets(selectedNeighborhood.osmId)}
            onSubmit={handleSubmit}
          />

          <BroadcastPreview
            broadcastKind={broadcastKind}
            title={title}
            body={body}
            severity={severity}
          />
        </div>

        <div className="broadcast-layout__sidebar">
          <BroadcastHistory
            history={history}
            loading={historyLoading}
            onRefresh={fetchHistory}
          />
        </div>
      </div>

      {showConfirm && (
        <ConfirmBroadcastModal
          broadcastKind={broadcastKind}
          title={title}
          body={body}
          severity={severity}
          expiryHours={expiryHours}
          targetLabel={getSelectedRegionLabel()}
          targetAll={noRegionRestriction}
          loading={loading}
          error={error}
          onConfirm={confirmSend}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
