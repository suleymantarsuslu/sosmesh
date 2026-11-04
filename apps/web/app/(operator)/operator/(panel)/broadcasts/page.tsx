'use client';

import React, { useState } from 'react';
import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { Button } from '../../../../../components/ui/Button';

type BroadcastHistory = {
  id: string;
  title: string;
  severity: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  hasRegion: boolean;
  deliveredCount: number;
  meshRelayCount: number;
};

type CreateBroadcastDto = {
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  expiryHours: number;
  regionLatitude?: number;
  regionLongitude?: number;
  regionRadiusKm?: number;
};

export default function BroadcastsPage() {
  const { t } = useOperatorPreferences();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [expiryHours, setExpiryHours] = useState(24);
  const [noRegionRestriction, setNoRegionRestriction] = useState(true);
  const [regionLatitude, setRegionLatitude] = useState<number | undefined>();
  const [regionLongitude, setRegionLongitude] = useState<number | undefined>();
  const [regionRadiusKm, setRegionRadiusKm] = useState<number | undefined>(10);
  const [showConfirm, setShowConfirm] = useState(false);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/operator/broadcasts/history?limit=50');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  React.useEffect(() => {
    fetchHistory();
    
    const eventSource = new EventSource('/api/operator/broadcasts/stream');
    eventSource.onmessage = (event) => {
      const broadcast = JSON.parse(event.data);
      setHistory((prev) => [
        {
          id: broadcast.id,
          title: broadcast.title,
          severity: broadcast.severity,
          createdBy: 'You',
          createdAt: broadcast.createdAt,
          expiresAt: broadcast.expiresAt,
          hasRegion: broadcast.regionLatitude != null,
          deliveredCount: 0,
          meshRelayCount: 0,
        },
        ...prev,
      ]);
    };

    return () => {
      eventSource.close();
    };
  }, []);

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
      const dto: CreateBroadcastDto = {
        title,
        body,
        severity,
        expiryHours,
      };

      if (!noRegionRestriction && regionLatitude != null && regionLongitude != null && regionRadiusKm != null) {
        dto.regionLatitude = regionLatitude;
        dto.regionLongitude = regionLongitude;
        dto.regionRadiusKm = regionRadiusKm;
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
      setRegionLatitude(undefined);
      setRegionLongitude(undefined);
      setRegionRadiusKm(10);
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

  return (
    <div className="operator-panel">
      <header className="operator-panel__header">
        <h1>{t('web.broadcasts.title')}</h1>
        <p>{t('web.broadcasts.subtitle')}</p>
      </header>

      <div className="operator-panel__content">
        <section className="broadcast-form-card">
          <h2>{t('web.broadcasts.formTitle')}</h2>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit} className="broadcast-form">
            <div className="form-field">
              <label htmlFor="broadcast-title">{t('web.broadcasts.notificationTitle')} *</label>
              <input
                id="broadcast-title"
                type="text"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="broadcast-body">{t('web.broadcasts.notificationBody')} *</label>
              <textarea
                id="broadcast-body"
                rows={5}
                maxLength={5000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="broadcast-severity">{t('web.broadcasts.severity')} *</label>
              <select
                id="broadcast-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as 'info' | 'warning' | 'critical')}
              >
                <option value="info">{t('web.broadcasts.severityInfo')}</option>
                <option value="warning">{t('web.broadcasts.severityWarning')}</option>
                <option value="critical">{t('web.broadcasts.severityCritical')}</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="broadcast-expiry">{t('web.broadcasts.expiryHours')} *</label>
              <input
                id="broadcast-expiry"
                type="number"
                min={1}
                max={168}
                value={expiryHours}
                onChange={(e) => setExpiryHours(parseInt(e.target.value, 10))}
                required
              />
            </div>

            <div className="form-field">
              <label>
                <input
                  type="checkbox"
                  checked={noRegionRestriction}
                  onChange={(e) => setNoRegionRestriction(e.target.checked)}
                />
                {t('web.broadcasts.noRegionRestriction')}
              </label>
            </div>

            {!noRegionRestriction && (
              <div className="region-fields">
                <div className="form-field">
                  <label htmlFor="region-lat">{t('web.broadcasts.regionLatitude')}</label>
                  <input
                    id="region-lat"
                    type="number"
                    step="0.000001"
                    min={-90}
                    max={90}
                    value={regionLatitude ?? ''}
                    onChange={(e) => setRegionLatitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="region-lng">{t('web.broadcasts.regionLongitude')}</label>
                  <input
                    id="region-lng"
                    type="number"
                    step="0.000001"
                    min={-180}
                    max={180}
                    value={regionLongitude ?? ''}
                    onChange={(e) => setRegionLongitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="region-radius">{t('web.broadcasts.regionRadiusKm')}</label>
                  <input
                    id="region-radius"
                    type="number"
                    step="0.1"
                    min={0.1}
                    max={10000}
                    value={regionRadiusKm ?? ''}
                    onChange={(e) => setRegionRadiusKm(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading}>
              {t('web.broadcasts.confirmSend')}
            </Button>
          </form>
        </section>

        <section className="broadcast-history">
          <h2>{t('web.broadcasts.historyTitle')}</h2>
          <Button variant="ghost" onClick={fetchHistory}>
            {t('common.refresh')}
          </Button>
          {history.length === 0 ? (
            <p>{t('web.broadcasts.historyEmpty')}</p>
          ) : (
            <table className="broadcast-history-table">
              <thead>
                <tr>
                  <th>{t('web.broadcasts.historyTitle')}</th>
                  <th>{t('web.broadcasts.historySeverity')}</th>
                  <th>{t('web.broadcasts.historyCreatedBy')}</th>
                  <th>{t('web.broadcasts.historyCreatedAt')}</th>
                  <th>{t('web.broadcasts.historyTarget')}</th>
                  <th>{t('web.broadcasts.historyDelivered')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.severity}</td>
                    <td>{item.createdBy}</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.hasRegion ? t('web.broadcasts.historyTargetRegion') : t('web.broadcasts.historyTargetAll')}</td>
                    <td>{item.deliveredCount} / {item.meshRelayCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {showConfirm && (
        <div className="confirm-dialog-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{t('web.broadcasts.confirmTitle')}</h3>
            <p>
              {noRegionRestriction
                ? t('web.broadcasts.confirmBodyAll')
                : t('web.broadcasts.confirmBodyRegion')
                    .replace('{{lat}}', String(regionLatitude))
                    .replace('{{lng}}', String(regionLongitude))
                    .replace('{{radiusKm}}', String(regionRadiusKm))}
            </p>
            <div className="dialog-actions">
              <Button onClick={confirmSend} disabled={loading}>
                {t('web.broadcasts.confirmSend')}
              </Button>
              <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={loading}>
                {t('web.broadcasts.confirmCancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
