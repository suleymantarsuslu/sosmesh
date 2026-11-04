import React from 'react';

import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { Icon } from '../../../../../features/cases/detail/icons';

type Props = {
  broadcastKind: 'standard' | 'relay_request';
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
};

export function BroadcastPreview({ broadcastKind, title, body, severity }: Props) {
  const { t } = useOperatorPreferences();

  const getSeverityIcon = () => {
    switch (severity) {
      case 'critical':
        return 'alert';
      case 'warning':
        return 'alert';
      default:
        return 'bell';
    }
  };

  return (
    <section className="cd2-card broadcast-preview">
      <div className="cd2-card__header">
        <div className="cd2-card__icon">
          <Icon name="pulse" size={16} />
        </div>
        <h2 className="cd2-card__title">{t('web.cases.detailTitle')}</h2>
      </div>

      <div className="cd2-card__body">
        <div className="broadcast-preview-label">
          {t('web.broadcasts.historyTitle')}
        </div>
        <div className="broadcast-preview-phone">
          <div className="broadcast-preview-phone__notch" />
          <div className="broadcast-preview-phone__content">
            <div className={`broadcast-preview-notification broadcast-preview-notification--${severity}`}>
              <div className="broadcast-preview-notification__header">
                <div className="broadcast-preview-notification__icon">
                  <Icon name={getSeverityIcon()} size={16} />
                </div>
                <span className="broadcast-preview-notification__app">
                  {t('app.name')}
                </span>
              </div>
              <div className="broadcast-preview-notification__title">
                {title || t('web.broadcasts.notificationTitle')}
              </div>
              <div className="broadcast-preview-notification__body">
                {body || t('web.broadcasts.notificationBody')}
              </div>
              {broadcastKind === 'relay_request' && (
                <div className="broadcast-preview-notification__actions">
                  <button className="broadcast-preview-button broadcast-preview-button--primary">
                    {t('web.broadcasts.relayRequestButton1')}
                  </button>
                  <button className="broadcast-preview-button">
                    {t('web.broadcasts.relayRequestButton2')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
