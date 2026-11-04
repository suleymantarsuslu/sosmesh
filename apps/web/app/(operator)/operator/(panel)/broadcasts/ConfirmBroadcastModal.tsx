import React, { useEffect, useRef } from 'react';

import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { Icon } from '../../../../../features/cases/detail/icons';

type Props = {
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  expiryHours: number;
  targetLabel: string;
  targetAll: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmBroadcastModal({
  title,
  body,
  severity,
  expiryHours,
  targetLabel,
  targetAll,
  loading,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useOperatorPreferences();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [loading, onCancel]);

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus();
    }
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onCancel();
    }
  };

  const getSeverityLabel = () => {
    const key = `web.broadcasts.severity${severity.charAt(0).toUpperCase() + severity.slice(1)}`;
    return t(key);
  };

  return (
    <div
      className="broadcast-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-confirm-title"
    >
      <div className="broadcast-modal" ref={modalRef} tabIndex={-1}>
        <div className="broadcast-modal__header">
          <Icon name="alert" size={20} />
          <h3 id="broadcast-confirm-title" className="broadcast-modal__title">
            {t('web.broadcasts.confirmTitle')}
          </h3>
          {!loading && (
            <button
              type="button"
              className="broadcast-modal__close"
              onClick={onCancel}
              aria-label={t('common.close')}
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        <div className="broadcast-modal__body">
          <div className="broadcast-modal-warning">
            <Icon name="alert" size={16} />
            <p>
              {targetAll
                ? t('web.broadcasts.confirmBodyAll')
                : t('web.broadcasts.confirmBodyRegion').replace('{{region}}', targetLabel)}
            </p>
          </div>

          <div className="broadcast-modal-summary">
            <div className="broadcast-modal-summary__row">
              <span className="broadcast-modal-summary__label">
                {t('web.broadcasts.notificationTitle')}:
              </span>
              <span className="broadcast-modal-summary__value">{title}</span>
            </div>

            <div className="broadcast-modal-summary__row">
              <span className="broadcast-modal-summary__label">
                {t('web.broadcasts.severity')}:
              </span>
              <span className={`broadcast-modal-summary__severity broadcast-modal-summary__severity--${severity}`}>
                {getSeverityLabel()}
              </span>
            </div>

            <div className="broadcast-modal-summary__row">
              <span className="broadcast-modal-summary__label">
                {t('web.broadcasts.expiryHours')}:
              </span>
              <span className="broadcast-modal-summary__value">{expiryHours}h</span>
            </div>

            <div className="broadcast-modal-summary__row">
              <span className="broadcast-modal-summary__label">
                {t('web.broadcasts.regionTarget')}:
              </span>
              <span className="broadcast-modal-summary__value">{targetLabel}</span>
            </div>

            <div className="broadcast-modal-summary__message">
              <div className="broadcast-modal-summary__label">
                {t('web.broadcasts.notificationBody')}:
              </div>
              <div className="broadcast-modal-summary__message-text">{body}</div>
            </div>
          </div>

          {error && (
            <div className="broadcast-modal-error">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="broadcast-modal__actions">
          <button
            type="button"
            className="cd2-btn"
            onClick={onCancel}
            disabled={loading}
          >
            {t('web.broadcasts.confirmCancel')}
          </button>
          <button
            type="button"
            className={`cd2-btn ${severity === 'critical' ? 'broadcast-modal__confirm--critical' : 'cd2-btn--primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Icon name="refresh" size={16} />
                {t('common.loading')}
              </>
            ) : (
              <>
                <Icon name="check" size={16} />
                {t('web.broadcasts.confirmSend')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
