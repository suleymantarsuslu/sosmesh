import React from 'react';

import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { Icon } from '../../../../../features/cases/detail/icons';
import { OpsChip } from '../../../../../features/ops/OpsPrimitives';

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

type Props = {
  history: BroadcastHistory[];
  loading: boolean;
  onRefresh: () => void;
};

export function BroadcastHistory({ history, loading, onRefresh }: Props) {
  const { t, locale } = useOperatorPreferences();

  const getSeverityTone = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'danger' as const;
      case 'warning':
        return 'warn' as const;
      default:
        return 'info' as const;
    }
  };

  return (
    <section className="cd2-card broadcast-history">
      <div className="cd2-card__header">
        <div className="cd2-card__icon">
          <Icon name="clock" size={16} />
        </div>
        <h2 className="cd2-card__title">{t('web.broadcasts.historyTitle')}</h2>
        <div className="cd2-card__actions">
          <button
            type="button"
            className="broadcast-history-refresh"
            onClick={onRefresh}
            disabled={loading}
            aria-label={t('common.refresh')}
          >
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      <div className="broadcast-history-list">
        {loading && history.length === 0 && (
          <div className="broadcast-history-loading">
            <Icon name="refresh" size={20} />
            <span>{t('states.loading')}</span>
          </div>
        )}

        {!loading && history.length === 0 && (
          <div className="broadcast-history-empty">
            <Icon name="bell" size={24} />
            <p className="broadcast-history-empty__title">
              {t('web.broadcasts.emptyState')}
            </p>
            <p className="broadcast-history-empty__hint">
              {t('web.broadcasts.emptyStateHint')}
            </p>
          </div>
        )}

        {history.map((item) => (
          <article key={item.id} className="broadcast-history-item">
            <div className="broadcast-history-item__header">
              <h3 className="broadcast-history-item__title">{item.title}</h3>
              <div className="broadcast-history-item__badges">
                {item.kind === 'relay_request' && (
                  <OpsChip tone="info" icon="bell">
                    {t('web.broadcasts.typeRelayRequest')}
                  </OpsChip>
                )}
                <OpsChip tone={getSeverityTone(item.severity)} icon="alert">
                  {t(`web.broadcasts.severity${item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}`)}
                </OpsChip>
              </div>
            </div>

            <p className="broadcast-history-item__body">{item.body}</p>

            <div className="broadcast-history-item__meta">
              <span className="broadcast-meta-item">
                <Icon name="user" size={12} />
                {item.createdBy}
              </span>
              <span className="broadcast-meta-item">
                <Icon name="clock" size={12} />
                {new Date(item.createdAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}
              </span>
            </div>

            <div className="broadcast-history-item__target">
              <Icon name="pin" size={12} />
              <span>{item.regionLabel || t('web.broadcasts.historyTargetAll')}</span>
            </div>

            <div className="broadcast-history-item__stats">
              <div className="broadcast-stat">
                <Icon name="check" size={13} />
                <span className="broadcast-stat__label">
                  {t('web.broadcasts.historyDelivered')}
                </span>
                <span className="broadcast-stat__value">{item.deliveredCount}</span>
              </div>
              <div className="broadcast-stat">
                <Icon name="users" size={13} />
                <span className="broadcast-stat__label">
                  {t('web.broadcasts.historyMeshRelayed')}
                </span>
                <span className="broadcast-stat__value">{item.meshRelayCount}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
