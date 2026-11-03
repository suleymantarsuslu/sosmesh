'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { Card } from '../../components/ui/Card';
import { DeliveryStateBadge } from '../../components/cases/DeliveryStateBadge';
import { Timeline } from '../../components/timeline/Timeline';

import type { OperatorCaseRow } from './types';

type TimelineEntry = {
  id: string;
  deliveryState: string;
  source: string;
  createdAt: string;
};

export function CaseDetailPanel({
  row,
  timeline,
}: {
  row: OperatorCaseRow | null;
  timeline: TimelineEntry[];
}) {
  const { t } = useOperatorPreferences();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCollapsed) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isCollapsed) {
        setIsCollapsed(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCollapsed]);

  if (!row) {
    return (
      <Card title={t('web.caseDetail.title')} className="cases-detail-panel">
        <p className="cases-detail-panel__empty">{t('web.caseDetail.emptyMessage')}</p>
      </Card>
    );
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div 
      ref={panelRef}
      className={`cases-detail-panel ${isCollapsed ? 'cases-detail-panel--collapsed' : ''}`}
      data-testid="case-detail-panel-wrapper"
    >
      <div className="cases-detail-panel__header">
        <h2 className="cases-detail-panel__title">{t('web.caseDetail.title')}</h2>
        <button
          type="button"
          onClick={toggleCollapse}
          className="cases-detail-panel__toggle"
          aria-label={isCollapsed ? t('web.caseDetail.expandAriaLabel') : t('web.caseDetail.closeAriaLabel')}
          aria-expanded={!isCollapsed}
          data-testid="case-detail-panel-toggle"
        >
          {isCollapsed ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="cases-detail-panel__content" data-testid="case-detail-panel">
          <dl className="cases-detail-panel__meta">
            <div>
              <dt>{t('web.caseDetail.priority')}</dt>
              <dd>{row.priority}</dd>
            </div>
            <div>
              <dt>{t('web.caseDetail.state')}</dt>
              <dd><DeliveryStateBadge state={row.deliveryState} /></dd>
            </div>
            <div>
              <dt>{t('web.caseDetail.location')}</dt>
              <dd>{t(`web.locationStatuses.${row.locationStatus}`) || row.locationStatus}</dd>
            </div>
          </dl>
          <Link 
            href={`/operator/cases/${row.incidentId}`}
            className="cases-detail-panel__open-button"
          >
            {t('web.cases.openFullCaseDetail')}
          </Link>
          <h3>{t('web.caseDetail.timelineTitle')}</h3>
          <Timeline entries={timeline} emptyMessage={t('web.caseDetail.timelineEmpty')} />
        </div>
      )}
    </div>
  );
}
