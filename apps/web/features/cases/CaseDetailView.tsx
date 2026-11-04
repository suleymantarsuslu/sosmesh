'use client';

import { useState } from 'react';
import Link from 'next/link';

import { DeliveryStateBadge } from '../../components/cases/DeliveryStateBadge';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { TranslatedMessageDisplay } from './TranslatedMessageDisplay';
import { Timeline } from '../../components/timeline/Timeline';
import type {
  AiTriageView,
  TranscriptView,
  SparkVisionView,
  SamVisionView,
  IncidentLinkSuggestionView,
} from '../ai/types';
import { FusionSuggestionsCard } from '../ai/FusionSuggestionsCard';
import { AssignmentPreviewPanel } from '../assignment/AssignmentPreviewPanel';
import { CaseAiSummaryCard } from './detail/CaseAiSummaryCard';
import { CaseAudioCard } from './detail/CaseAudioCard';
import { CaseLocationCard } from './detail/CaseLocationCard';
import { CasePhotoGallery } from './detail/CasePhotoGallery';
import { CaseSection } from './detail/CaseSection';
import { formatAccuracyMeters, interpolate } from './detail/format';
import { Icon } from './detail/icons';
import {
  getReviewStatusLabel,
  getValidTransitions,
  type OperatorCaseDetail,
  type OperatorTranscript,
} from './types';

type AiData = {
  triage: AiTriageView | null;
  transcript: TranscriptView | null;
  sparkVision: SparkVisionView | null;
  samVision: SamVisionView | null;
  linkSuggestions: IncidentLinkSuggestionView[];
};

type Props = {
  detail: OperatorCaseDetail;
  aiData: AiData | null;
  aiState?: 'loading' | 'ready' | 'error';
  onRefresh: () => Promise<void>;
  onRetryAi?: () => void | Promise<void>;
};

function mergeTranscripts(
  fromDetail: OperatorCaseDetail['transcripts'],
  fromBundle: TranscriptView | null
): OperatorTranscript[] {
  const list = [...(fromDetail ?? [])];
  if (fromBundle && !list.some((item) => item.attachmentId === fromBundle.attachmentId)) {
    list.push(fromBundle);
  }
  return list;
}

function humanizeAction(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getSeverityClass(priority: number): string {
  if (priority <= 1) return 'severity--critical';
  if (priority <= 2) return 'severity--high';
  if (priority <= 3) return 'severity--medium';
  return 'severity--low';
}

function formatRelativeTime(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return locale === 'tr' ? 'Az önce' : 'Just now';
  if (diffMins < 60) return locale === 'tr' ? `${diffMins} dk önce` : `${diffMins}m ago`;
  if (diffHours < 24) return locale === 'tr' ? `${diffHours} sa önce` : `${diffHours}h ago`;
  return locale === 'tr' ? `${diffDays} gün önce` : `${diffDays}d ago`;
}

export function CaseDetailView({
  detail,
  aiData,
  aiState = 'ready',
  onRefresh,
  onRetryAi,
}: Props) {
  const { t, locale } = useOperatorPreferences();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const [version, setVersion] = useState(detail.version);
  const [reviewStatus, setReviewStatus] = useState(detail.reviewStatus);
  const [personCount, setPersonCount] = useState(
    detail.verifiedMetadata.personCount ?? ''
  );
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState(false);

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
      if (!hasAttemptedRefresh) {
        setHasAttemptedRefresh(true);
        await onRefresh();
        setVersion(detail.version);
        setConflictMessage(t('web.cases.conflictActualChange'));
        return;
      }
      setConflictMessage(t('web.cases.conflictActualChange'));
      return;
    }
    
    if (!res.ok) {
      return;
    }
    
    const body = (await res.json()) as { version: number };
    setVersion(body.version);
    setHasAttemptedRefresh(false);
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
      if (!hasAttemptedRefresh) {
        setHasAttemptedRefresh(true);
        await onRefresh();
        const refreshedVersion = detail.version;
        const refreshedStatus = detail.reviewStatus;
        
        if (refreshedStatus !== reviewStatus) {
          setConflictMessage(t('web.cases.conflictActualChange'));
        } else {
          setVersion(refreshedVersion);
          const retryRes = await fetch(`/api/operator/cases/${detail.incidentId}/review-status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expectedVersion: refreshedVersion, reviewStatus: target }),
          });
          if (retryRes.ok) {
            const retryBody = (await retryRes.json()) as { version: number; reviewStatus: string };
            setVersion(retryBody.version);
            setReviewStatus(retryBody.reviewStatus);
            await onRefresh();
          }
        }
        setBusy(false);
        return;
      }
      setConflictMessage(t('web.cases.conflictActualChange'));
      return;
    }
    
    if (!res.ok) {
      return;
    }
    
    const body = (await res.json()) as { version: number; reviewStatus: string };
    setVersion(body.version);
    setReviewStatus(body.reviewStatus);
    setHasAttemptedRefresh(false);
    await onRefresh();
  };

  const audioAttachments = detail.attachments?.filter((a) => a.kind === 'audio') ?? [];
  const photoAttachments = detail.attachments?.filter((a) => a.kind === 'photo') ?? [];
  const accuracy = formatAccuracyMeters(detail.verifiedMetadata.accuracyMeters);
  const hasCoordinates = caseCoordinates !== null;
  const locationLabel = detail.verifiedMetadata.locationApproximate
    ? t('web.cases.approximateLocation')
    : hasCoordinates
    ? t('web.cases.preciseLocation')
    : t('web.cases.locationNotAvailable');

  return (
    <article className="case-detail-modern cd2" data-testid="operator-case-detail">
      <header className="cd2-header">
        <div className="cd2-header__top">
          <Link href="/operator/cases" className="cd2-back">
            ← {t('web.cases.backToCases')}
          </Link>
          {conflictMessage && (
            <div className="cd2-conflict" role="alert" data-testid="case-version-conflict">
              <Icon name="alert" size={16} />
              <span>{conflictMessage}</span>
              <button
                type="button"
                className="cd2-btn cd2-btn--ghost"
                onClick={async () => {
                  setConflictMessage(null);
                  setHasAttemptedRefresh(false);
                  await onRefresh();
                  setVersion(detail.version);
                  setReviewStatus(detail.reviewStatus);
                }}
              >
                {t('web.common.refresh')}
              </button>
            </div>
          )}
        </div>

        <div className="cd2-header__main">
          <div className="cd2-header__identity">
            <h1 className="cd2-title">
              <span className="cd2-id" title={detail.incidentId}>
                {detail.incidentId.slice(0, 8)}
              </span>
              <span className={`cd2-priority ${getSeverityClass(detail.priority)}`}>
                P{detail.priority}
              </span>
              <DeliveryStateBadge state={detail.deliveryState} />
            </h1>
            <ul className="cd2-chiprow" aria-label={t('web.cases.caseHeaderCardTitle')}>
              <li className="cd2-meta-chip" title={new Date(detail.receivedAt).toLocaleString(dateLocale)}>
                <Icon name="clock" size={14} />
                <span>{formatRelativeTime(detail.receivedAt, locale)}</span>
                <span className="cd2-meta-chip__muted">
                  {new Date(detail.receivedAt).toLocaleString(dateLocale)}
                </span>
              </li>
              <li className="cd2-meta-chip">
                <Icon name="route" size={14} />
                <span className="cd2-meta-chip__muted">{t('web.cases.sourceLabel')}</span>
                <span>{detail.source || '—'}</span>
              </li>
              <li
                className={`cd2-meta-chip ${
                  detail.verifiedMetadata.locationApproximate
                    ? 'cd2-meta-chip--warn'
                    : hasCoordinates
                    ? 'cd2-meta-chip--ok'
                    : ''
                }`}
              >
                <Icon name="pin" size={14} />
                <span>{locationLabel}</span>
              </li>
              {hasCoordinates && !detail.verifiedMetadata.locationApproximate && accuracy ? (
                <li className="cd2-meta-chip">
                  <span>{interpolate(t('web.cases.accuracyValue'), { meters: accuracy })}</span>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="cd2-header__actions">
            <label className="cd2-status">
              <span className="cd2-status__label">{t('web.cases.statusLabel')}</span>
              <select
                value={reviewStatus}
                onChange={(e) => changeReviewStatus(e.target.value)}
                disabled={busy}
                className="cd2-select"
                data-testid="case-review-status-select"
              >
                <option value={reviewStatus}>{getReviewStatusLabel(reviewStatus, t)}</option>
                {getValidTransitions(reviewStatus).map((status) => (
                  <option key={status} value={status}>
                    {getReviewStatusLabel(status, t)}
                  </option>
                ))}
              </select>
            </label>
            {busy && (
              <span className="cd2-saving" data-testid="status-saving">
                {t('web.common.saving')}…
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="cd2-grid">
        <div className="cd2-col">
          <CaseSection title={t('web.cases.messageMediaTitle')} icon="message" testId="case-message-card">
            {detail.originalText ? (
              <TranslatedMessageDisplay
                originalText={detail.originalText}
                translatedText={detail.translatedText}
                detectedLanguage={detail.detectedLanguage}
                uiLanguage={locale}
              />
            ) : (
              <p className="cd2-empty" data-testid="case-original-missing">
                {t('web.cases.originalMissing')}
              </p>
            )}
          </CaseSection>

          <CaseAiSummaryCard
            detail={detail}
            triage={aiData?.triage ?? null}
            state={aiState}
            onRetry={onRetryAi ?? onRefresh}
          />

          {(aiData?.linkSuggestions?.length ?? 0) > 0 && (
            <FusionSuggestionsCard
              incidentId={detail.incidentId}
              suggestions={aiData?.linkSuggestions ?? []}
              onRefresh={onRefresh}
            />
          )}

          {audioAttachments.length > 0 && (
            <CaseAudioCard
              attachments={audioAttachments}
              transcripts={mergeTranscripts(detail.transcripts, aiData?.transcript ?? null)}
            />
          )}

          {photoAttachments.length > 0 && (
            <CasePhotoGallery
              incidentId={detail.incidentId}
              photos={photoAttachments}
              sparkVision={aiData?.sparkVision ?? null}
            />
          )}
        </div>

        <div className="cd2-col">
          <CaseLocationCard
            latitude={caseCoordinates?.latitude ?? null}
            longitude={caseCoordinates?.longitude ?? null}
            accuracyMeters={detail.verifiedMetadata.accuracyMeters}
            approximate={detail.verifiedMetadata.locationApproximate}
            locationStatus={detail.verifiedMetadata.locationStatus}
          />

          <CaseSection title={t('web.cases.verifiedMetadataTitle')} icon="shield" testId="case-metadata-card">
            <div className="cd2-field-row">
              <label htmlFor="case-person-count" className="cd2-label">
                {t('web.cases.personCount')}
              </label>
              <input
                id="case-person-count"
                type="number"
                min={0}
                inputMode="numeric"
                value={personCount}
                placeholder={t('web.cases.personCountUnknown')}
                onChange={(e) => setPersonCount(e.target.value)}
                className="cd2-input cd2-input--narrow"
                data-testid="case-person-count-input"
              />
            </div>
            <div className="cd2-field-row">
              <span className="cd2-label">{t('web.cases.locationStatus')}</span>
              <span className="cd2-value">
                {t(`web.locationStatuses.${detail.verifiedMetadata.locationStatus}`) ||
                  detail.verifiedMetadata.locationStatus}
                {detail.verifiedMetadata.locationApproximate && (
                  <span className="cd2-pill cd2-pill--warn" title={t('web.cases.locationApproximate')}>
                    {t('web.cases.locationApproximateShort')}
                  </span>
                )}
              </span>
            </div>
            <div className="cd2-form-footer">
              <span className="cd2-muted">{t('web.cases.metadataHint')}</span>
              <button
                type="button"
                className="cd2-btn cd2-btn--primary"
                disabled={busy}
                onClick={saveCorrection}
                data-testid="case-save-correction"
              >
                {t('web.cases.saveCorrection')}
              </button>
            </div>
          </CaseSection>

          <CaseSection title={t('web.cases.assignmentPreview')} icon="route" testId="case-assignment-card">
            <AssignmentPreviewPanel
              incidentId={detail.incidentId}
              caseCoordinates={caseCoordinates}
              hideTitle
            />
          </CaseSection>

          <CaseSection title={t('web.cases.timelineEventTitle')} icon="clock" testId="case-timeline-card">
            <Timeline entries={detail.timeline} />
          </CaseSection>

          <CaseSection title={t('web.cases.auditLogTitle')} icon="list" testId="case-audit-card">
            {detail.audit.length === 0 ? (
              <p className="cd2-empty">{t('web.cases.auditEmpty')}</p>
            ) : (
              <ol className="timeline" data-testid="case-audit-list">
                {detail.audit.map((entry, index) => (
                  <li
                    key={entry.id}
                    className={`timeline__item ${
                      index === detail.audit.length - 1 ? 'timeline__item--last' : ''
                    }`}
                    data-testid={`case-audit-${entry.action}`}
                  >
                    <div
                      className="timeline__marker"
                      style={{ backgroundColor: 'var(--color-info, #1976d2)' }}
                    />
                    <div className="timeline__content">
                      <div className="timeline__title">{humanizeAction(entry.action)}</div>
                      {entry.actorDisplayName ? (
                        <div className="timeline__source">
                          {t('web.cases.actorLabel')}: {entry.actorDisplayName}
                        </div>
                      ) : null}
                      <time
                        className="timeline__time"
                        dateTime={entry.createdAt}
                        title={new Date(entry.createdAt).toLocaleString(dateLocale)}
                      >
                        {formatRelativeTime(entry.createdAt, locale)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CaseSection>
        </div>
      </div>
    </article>
  );
}
