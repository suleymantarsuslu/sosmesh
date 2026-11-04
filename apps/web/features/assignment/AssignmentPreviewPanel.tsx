'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { pickActivePreview } from './pick-active-preview';
import type { AssignmentPreviewRoute, AssignmentRecommendationRow } from './types';

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(String(value)),
    template
  );
}

type Props = {
  incidentId: string;
  caseCoordinates: { latitude: number; longitude: number } | null;
  onPreviewChange?: (route: AssignmentPreviewRoute | null) => void;
  /** Hide the visible heading when the surrounding card already shows the title. */
  hideTitle?: boolean;
};

export function AssignmentPreviewPanel({
  incidentId,
  caseCoordinates,
  onPreviewChange,
  hideTitle = false,
}: Props) {
  const { t } = useOperatorPreferences();
  const [items, setItems] = useState<AssignmentRecommendationRow[]>([]);
  const [role, setRole] = useState<'OPERATOR' | 'COORDINATOR' | 'ADMIN'>('OPERATOR');
  const [assigneeId, setAssigneeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const tRef = useRef(t);
  tRef.current = t;

  const loadRole = useCallback(async () => {
    const res = await fetch('/api/operator/organization', { cache: 'no-store' });
    if (!res.ok) {
      return;
    }
    const body = (await res.json()) as { role?: 'OPERATOR' | 'COORDINATOR' | 'ADMIN' };
    if (body.role) {
      setRole(body.role);
    }
  }, []);

  const loadPlan = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/operator/incidents/${incidentId}/recommendations`, {
      method: 'POST',
      cache: 'no-store',
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(tRef.current('web.cases.assignmentLoadError'));
      setLoaded(true);
      return;
    }
    const body = (await res.json()) as { items: AssignmentRecommendationRow[] };
    setItems(body.items);
    setLoaded(true);
  }, [incidentId]);

  useEffect(() => {
    void loadRole();
    void loadPlan();
  }, [loadRole, loadPlan]);

  const activePreview = useMemo(
    (): AssignmentPreviewRoute | null => pickActivePreview(items, caseCoordinates),
    [items, caseCoordinates]
  );

  useEffect(() => {
    onPreviewChange?.(activePreview);
  }, [activePreview, onPreviewChange]);

  const reject = async (recommendationId: string) => {
    setBusy(true);
    const res = await fetch(`/api/operator/recommendations/${recommendationId}/reject`, {
      method: 'PATCH',
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(t('web.cases.assignmentRejectFailed'));
      return;
    }
    await loadPlan();
  };

  const confirm = async (recommendationId: string) => {
    if (!assigneeId.trim()) {
      setMessage(t('web.cases.assignmentPickAssignee'));
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/operator/recommendations/${recommendationId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeId: assigneeId.trim() }),
    });
    setBusy(false);
    if (res.status === 403) {
      setMessage(t('web.cases.assignmentCoordinatorOnlyError'));
      return;
    }
    if (!res.ok) {
      setMessage(t('web.cases.assignmentConfirmFailed'));
      return;
    }
    setMessage(t('web.cases.assignmentConfirmed'));
    await loadPlan();
  };

  const sendFeedback = async (recommendationId: string, rating: 'HELPFUL' | 'NOT_HELPFUL') => {
    await fetch(`/api/operator/recommendations/${recommendationId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    });
  };

  const canConfirm = role === 'COORDINATOR' || role === 'ADMIN';

  const noteFor = (row: AssignmentRecommendationRow): string => {
    const parts: string[] = [];
    if (row.available) {
      parts.push(
        row.resourceName
          ? fill(t('web.cases.assignmentNoteAvailable'), {
              team: row.teamName,
              resource: row.resourceName,
            })
          : fill(t('web.cases.assignmentNoteTeamAvailable'), { team: row.teamName })
      );
    } else {
      parts.push(fill(t('web.cases.assignmentNoteBusy'), { team: row.teamName }));
    }
    if (row.distanceKm !== null && row.distanceKm !== undefined) {
      parts.push(fill(t('web.cases.assignmentNoteDistance'), { km: row.distanceKm.toFixed(1) }));
    }
    parts.push(t('web.cases.assignmentNoteDecision'));
    return parts.join(' ');
  };

  return (
    <section
      className="assignment-preview"
      aria-labelledby="assignment-preview-title"
      data-testid="assignment-preview-panel"
    >
      <h2 id="assignment-preview-title" className={hideTitle ? 'cd2-sr-only' : undefined}>
        {t('web.cases.assignmentPreviewTitle')}
      </h2>
      <p className="assignment-preview__disclaimer" data-testid="assignment-preview-disclaimer">
        {t('web.cases.assignmentDisclaimer')}
      </p>
      {message ? (
        <p role="status" className="assignment-preview__message" data-testid="assignment-preview-message">
          {message}
        </p>
      ) : null}
      {!loaded && items.length === 0 ? (
        <p className="assignment-preview__loading" data-testid="assignment-preview-loading">
          {t('web.cases.assignmentLoadingPlan')}
        </p>
      ) : items.length === 0 ? (
        <p data-testid="assignment-preview-empty">{t('web.cases.assignmentEmpty')}</p>
      ) : (
        <ul className="assignment-preview__list">
          {items.map((row) => (
            <li key={row.id} data-testid={`assignment-preview-item-${row.rank}`}>
              <div className="assignment-preview__head">
                <span className="assignment-preview__rank">#{row.rank}</span>
                <strong>
                  {row.teamName}
                  {row.resourceName ? ` · ${row.resourceName}` : ''}
                </strong>
                <span
                  className={`assignment-preview__badge ${
                    row.available ? 'assignment-preview__badge--ok' : 'assignment-preview__badge--busy'
                  }`}
                >
                  {row.available
                    ? t('web.cases.assignmentAvailable')
                    : t('web.cases.assignmentUnavailable')}
                </span>
              </div>
              <p className="assignment-preview__note">{noteFor(row)}</p>
              {row.aiRationale ? <p className="assignment-preview__ai">{row.aiRationale}</p> : null}
              {row.missingInfo.length > 0 ? (
                <ul data-testid="assignment-preview-missing">
                  {row.missingInfo.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              <p className="assignment-preview__freshness">
                {t('web.cases.assignmentDataAge')}: {row.dataFreshness.ageMinutes}{' '}
                {t('web.cases.assignmentMinutesShort')}
                {row.dataFreshness.stale ? ` · ${t('web.cases.assignmentStale')}` : ''}
              </p>
              <div className="assignment-preview__actions">
                <button
                  type="button"
                  className="cd2-btn cd2-btn--ghost"
                  disabled={busy || row.status !== 'PROPOSED'}
                  onClick={() => reject(row.id)}
                  data-testid={`assignment-reject-${row.rank}`}
                >
                  {t('web.cases.assignmentReject')}
                </button>
                <button
                  type="button"
                  className="cd2-btn cd2-btn--ghost"
                  disabled={busy || row.status !== 'PROPOSED'}
                  onClick={() => sendFeedback(row.id, 'NOT_HELPFUL')}
                  data-testid={`assignment-feedback-${row.rank}`}
                >
                  {t('web.cases.assignmentFeedback')}
                </button>
              </div>
              {canConfirm ? (
                <div className="assignment-preview__confirm">
                  <label className="assignment-preview__assignee">
                    <span>{t('web.cases.assignmentAssigneeId')}</span>
                    <input
                      className="cd2-input"
                      value={assigneeId}
                      placeholder={t('web.cases.assignmentAssigneePlaceholder')}
                      onChange={(event) => setAssigneeId(event.target.value)}
                      data-testid="assignment-assignee-input"
                    />
                  </label>
                  <button
                    type="button"
                    className="cd2-btn cd2-btn--primary"
                    disabled={busy || row.status !== 'PROPOSED' || !row.available}
                    onClick={() => confirm(row.id)}
                    data-testid={`assignment-confirm-${row.rank}`}
                  >
                    {t('web.cases.assignmentConfirm')}
                  </button>
                </div>
              ) : (
                <p className="assignment-preview__coordinator-only" data-testid="assignment-coordinator-only">
                  {t('web.cases.assignmentCoordinatorOnly')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
