'use client';

import { useState } from 'react';

import { DeliveryStateBadge } from '../../components/cases/DeliveryStateBadge';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { AiSuggestionPanel } from './AiSuggestionPanel';
import { AssignmentPreviewPanel } from '../assignment/AssignmentPreviewPanel';
import { REVIEW_STATUS_OPTIONS, type OperatorCaseDetail } from './types';

type Props = {
  detail: OperatorCaseDetail;
  onRefresh: () => Promise<void>;
};

export function CaseDetailView({ detail, onRefresh }: Props) {
  const { t, locale } = useOperatorPreferences();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const [version, setVersion] = useState(detail.version);
  const [reviewStatus, setReviewStatus] = useState(detail.reviewStatus);
  const [personCount, setPersonCount] = useState(
    detail.verifiedMetadata.personCount ?? ''
  );
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const caseCoordinates =
    detail.verifiedMetadata.latitude !== null && detail.verifiedMetadata.longitude !== null
      ? {
          latitude: detail.verifiedMetadata.latitude,
          longitude: detail.verifiedMetadata.longitude,
        }
      : null;

  const saveCorrection = async () => {
    setBusy(true);
    setConflictMessage(null);
    const res = await fetch(`/api/operator/cases/${detail.incidentId}/corrections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: version,
        personCount: personCount === '' ? null : Number(personCount),
      }),
    });
    setBusy(false);
    if (res.status === 409) {
      setConflictMessage(t('web.cases.conflictMessage'));
      return;
    }
    if (!res.ok) {
      return;
    }
    const body = (await res.json()) as { version: number };
    setVersion(body.version);
    await onRefresh();
  };

  const changeReviewStatus = async (target: string) => {
    setBusy(true);
    setConflictMessage(null);
    const res = await fetch(`/api/operator/cases/${detail.incidentId}/review-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: version, reviewStatus: target }),
    });
    setBusy(false);
    if (res.status === 409) {
      setConflictMessage(t('web.cases.conflictMessage'));
      return;
    }
    if (!res.ok) {
      return;
    }
    const body = (await res.json()) as { version: number; reviewStatus: string };
    setVersion(body.version);
    setReviewStatus(body.reviewStatus);
    await onRefresh();
  };

  return (
    <article className="case-detail case-detail--modern" data-testid="operator-case-detail">
      <header className="case-detail__header">
        <h1>{t('web.cases.detailTitle')}</h1>
        <p>
          <span className="case-detail__id">{detail.incidentId.slice(0, 8)}…</span>
          <span className="case-detail__review" data-testid="case-review-status">
            {reviewStatus}
          </span>
        </p>
        {conflictMessage ? (
          <p className="case-detail__conflict" role="alert" data-testid="case-version-conflict">
            {conflictMessage}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="case-original-title">
        <h2 id="case-original-title">{t('web.cases.originalTitle')}</h2>
        <p className="case-detail__original" data-testid="case-original-text">
          {detail.originalText ?? t('web.cases.originalMissing')}
        </p>
      </section>

      <section aria-labelledby="case-meta-title">
        <h2 id="case-meta-title">{t('web.cases.metaTitle')}</h2>
        <dl>
          <div>
            <dt id="case-person-count-label">{t('web.cases.personCount')}</dt>
            <dd>
              <input
                type="number"
                min={0}
                aria-labelledby="case-person-count-label"
                value={personCount}
                onChange={(event) => setPersonCount(event.target.value)}
                data-testid="case-person-count-input"
              />
            </dd>
          </div>
          <div>
            <dt>{t('web.cases.locationStatus')}</dt>
            <dd>{detail.verifiedMetadata.locationStatus}</dd>
          </div>
        </dl>
        <button
          type="button"
          className="ui-button"
          disabled={busy}
          onClick={() => saveCorrection()}
          data-testid="case-save-correction"
        >
          {t('web.cases.saveCorrection')}
        </button>
      </section>

      <AiSuggestionPanel ai={detail.ai} />

      <AssignmentPreviewPanel incidentId={detail.incidentId} caseCoordinates={caseCoordinates} />

      <section aria-labelledby="case-actions-title">
        <h2 id="case-actions-title">{t('web.cases.operatorStatusTitle')}</h2>
        <div className="case-detail__review-actions">
          {REVIEW_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="ui-button ui-button--secondary"
              disabled={busy || reviewStatus === option.value}
              onClick={() => changeReviewStatus(option.value)}
              data-testid={`case-review-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-label={t('web.cases.auditTitle')}>
        <h2>{t('web.cases.auditTitle')}</h2>
        <ul className="case-detail__audit" data-testid="case-audit-list">
          {detail.audit.length === 0 ? (
            <li>{t('web.cases.auditEmpty')}</li>
          ) : (
            detail.audit.map((entry) => (
              <li key={entry.id} data-testid={`case-audit-${entry.action}`}>
                <strong>{entry.action}</strong>
                <time dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString(dateLocale)}
                </time>
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-label={t('web.cases.timelineTitle')}>
        <h2>{t('web.cases.timelineTitle')}</h2>
        <ol className="case-detail__timeline" data-testid="case-detail-timeline">
          {detail.timeline.map((entry) => (
            <li key={entry.id} className="case-detail__timeline-item">
              <DeliveryStateBadge state={entry.deliveryState} />
              <span className="case-detail__timeline-source">{entry.source}</span>
              <time dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString(dateLocale)}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
