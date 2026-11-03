'use client';

import { useEffect, useRef } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { DeliveryStateBadge } from '../../components/cases/DeliveryStateBadge';
import { Timeline } from '../../components/timeline/Timeline';
import type { OperatorCaseRow } from './types';

type TimelineEntry = {
  id: string;
  deliveryState: string;
  source: string;
  createdAt: string;
};

type Props = {
  open: boolean;
  row: OperatorCaseRow | null;
  timeline: TimelineEntry[];
  onClose: () => void;
};

export function CaseDrawer({ open, row, timeline, onClose }: Props) {
  const { t, locale } = useOperatorPreferences();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open || !row) {
    return null;
  }

  return (
    <aside
      className="case-drawer"
      role="dialog"
      aria-labelledby="case-drawer-title"
      aria-modal="true"
      data-testid="case-drawer"
    >
      <header className="case-drawer__header">
        <h2 id="case-drawer-title">{t('web.caseDetail.drawerTitle')}</h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="case-drawer__close"
          aria-label={t('web.caseDetail.closeAriaLabel')}
          data-testid="case-drawer-close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="case-drawer__close-text">{t('web.caseDetail.close')}</span>
        </button>
      </header>
      <dl className="case-drawer__meta">
        <div>
          <dt>{t('web.cases.tableHeaders.case')}</dt>
          <dd>{row.incidentId.slice(0, 8)}…</dd>
        </div>
        <div>
          <dt>{t('web.caseDetail.state')}</dt>
          <dd><DeliveryStateBadge state={row.deliveryState} /></dd>
        </div>
        <div>
          <dt>{t('web.caseDetail.location')}</dt>
          <dd>{t(`web.locationStatuses.${row.locationStatus}`) || row.locationStatus}</dd>
        </div>
        <div>
          <dt>{t('web.cases.tableHeaders.accuracy')}</dt>
          <dd>
            {row.accuracyMeters != null 
              ? `${Math.round(row.accuracyMeters)} m` 
              : t('web.locationStatuses.UNKNOWN')}
          </dd>
        </div>
      </dl>
      <section aria-label={t('web.caseDetail.timelineTitle')}>
        <h3>{t('web.caseDetail.timelineTitle')}</h3>
        <Timeline entries={timeline} emptyMessage={t('web.caseDetail.timelineEmpty')} />
      </section>
    </aside>
  );
}
