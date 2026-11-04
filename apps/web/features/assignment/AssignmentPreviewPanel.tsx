'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { Icon } from '../cases/detail/icons';
import { pickActivePreview } from './pick-active-preview';
import type { AssignableTeam, AssignmentPreviewRoute, AssignmentRecommendationRow } from './types';

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(String(value)),
    template
  );
}

type Role = 'OPERATOR' | 'COORDINATOR' | 'ADMIN';
type Rating = 'HELPFUL' | 'NOT_HELPFUL';
type Notice = { kind: 'info' | 'error'; text: string };

const TASK_STATUS_KEY: Record<string, string> = {
  PROPOSED: 'web.tasks.statusProposed',
  ASSIGNED: 'web.tasks.statusAssigned',
  ACCEPTED: 'web.tasks.statusAccepted',
  WITHDRAWN: 'web.tasks.statusWithdrawn',
  CLOSED: 'web.tasks.statusClosed',
};

type Props = {
  incidentId: string;
  caseCoordinates: { latitude: number; longitude: number } | null;
  onPreviewChange?: (route: AssignmentPreviewRoute | null) => void;
  /** Hide the visible heading when the surrounding card already shows the title. */
  hideTitle?: boolean;
};

async function errorCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { code?: unknown };
    return typeof body.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

export function AssignmentPreviewPanel({
  incidentId,
  caseCoordinates,
  onPreviewChange,
  hideTitle = false,
}: Props) {
  const { t, locale } = useOperatorPreferences();
  const [items, setItems] = useState<AssignmentRecommendationRow[]>([]);
  const [role, setRole] = useState<Role>('OPERATOR');
  const [teams, setTeams] = useState<AssignableTeam[] | null>(null);
  const [teamsFailed, setTeamsFailed] = useState(false);
  const [teamChoice, setTeamChoice] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<Rating>('HELPFUL');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackDone, setFeedbackDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loaded, setLoaded] = useState(false);
  const tRef = useRef(t);
  tRef.current = t;

  const canConfirm = role === 'COORDINATOR' || role === 'ADMIN';

  const loadRole = useCallback(async () => {
    const res = await fetch('/api/operator/organization', { cache: 'no-store' });
    if (!res.ok) {
      return;
    }
    const body = (await res.json()) as { role?: Role };
    if (body.role) {
      setRole(body.role);
    }
  }, []);

  const readList = useCallback(async (): Promise<AssignmentRecommendationRow[] | null> => {
    const res = await fetch(`/api/operator/incidents/${incidentId}/recommendations`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    return ((await res.json()) as { items: AssignmentRecommendationRow[] }).items;
  }, [incidentId]);

  /** Generates a fresh plan (only proposals; never creates tasks). */
  const plan = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`/api/operator/incidents/${incidentId}/recommendations`, {
      method: 'POST',
      cache: 'no-store',
    });
    if (!res.ok) {
      setNotice({ kind: 'error', text: tRef.current('web.cases.assignmentLoadError') });
      return false;
    }
    setItems(((await res.json()) as { items: AssignmentRecommendationRow[] }).items);
    return true;
  }, [incidentId]);

  /** Initial load: keep a confirmed assignment as is, otherwise plan fresh proposals. */
  const loadInitial = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    const existing = await readList();
    if (existing?.some((row) => row.status === 'CONFIRMED')) {
      setItems(existing);
    } else {
      await plan();
    }
    setBusy(false);
    setLoaded(true);
  }, [readList, plan]);

  const reload = useCallback(async () => {
    const list = await readList();
    if (list) {
      setItems(list);
    }
  }, [readList]);

  useEffect(() => {
    void loadRole();
    void loadInitial();
  }, [loadRole, loadInitial]);

  useEffect(() => {
    if (!canConfirm) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/operator/teams', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('teams');
        }
        const body = (await res.json()) as { items?: AssignableTeam[] };
        if (!cancelled) {
          setTeams((body.items ?? []).map((team) => ({ id: team.id, name: team.name })));
        }
      } catch {
        if (!cancelled) {
          setTeamsFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canConfirm]);

  const visible = useMemo(
    () =>
      items
        .filter((row) => row.status !== 'REJECTED')
        .sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === 'CONFIRMED' ? -1 : 1;
          }
          return a.rank - b.rank;
        }),
    [items]
  );

  const activePreview = useMemo(
    (): AssignmentPreviewRoute | null => pickActivePreview(visible, caseCoordinates),
    [visible, caseCoordinates]
  );

  useEffect(() => {
    onPreviewChange?.(activePreview);
  }, [activePreview, onPreviewChange]);

  const reject = async (recommendationId: string) => {
    setBusy(true);
    setNotice(null);
    setConfirming(null);
    try {
      const res = await fetch(`/api/operator/recommendations/${recommendationId}/reject`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const code = await errorCode(res);
        setNotice({
          kind: 'error',
          text:
            code === 'INVALID_STATE'
              ? t('web.cases.assignmentAlreadyFinalized')
              : t('web.cases.assignmentRejectFailed'),
        });
        if (code === 'INVALID_STATE') {
          await reload();
        }
        return;
      }
      setNotice({ kind: 'info', text: t('web.cases.assignmentRejected') });
      await reload();
    } catch {
      setNotice({ kind: 'error', text: t('web.cases.assignmentRejectFailed') });
    } finally {
      setBusy(false);
    }
  };

  const selectedTeamId = (row: AssignmentRecommendationRow): string =>
    teamChoice[row.id] ?? row.teamId;

  const teamName = (row: AssignmentRecommendationRow): string => {
    const id = selectedTeamId(row);
    return teams?.find((team) => team.id === id)?.name ?? row.teamName;
  };

  const confirm = async (row: AssignmentRecommendationRow) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/operator/recommendations/${row.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeamId(row) }),
      });
      if (res.status === 403) {
        setNotice({ kind: 'error', text: t('web.cases.assignmentCoordinatorOnlyError') });
        return;
      }
      if (!res.ok) {
        const code = await errorCode(res);
        setNotice({
          kind: 'error',
          text:
            code === 'INVALID_STATE'
              ? t('web.cases.assignmentAlreadyFinalized')
              : t('web.cases.assignmentConfirmFailed'),
        });
        if (code === 'INVALID_STATE') {
          await reload();
        }
        return;
      }
      setConfirming(null);
      setNotice({
        kind: 'info',
        text: fill(t('web.cases.assignmentConfirmed'), { team: teamName(row) }),
      });
      await reload();
    } catch {
      setNotice({ kind: 'error', text: t('web.cases.assignmentConfirmFailed') });
    } finally {
      setBusy(false);
    }
  };

  const sendFeedback = async (recommendationId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/operator/recommendations/${recommendationId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: feedbackRating, note: feedbackNote }),
      });
      if (!res.ok) {
        setNotice({ kind: 'error', text: t('web.cases.assignmentFeedbackFailed') });
        return;
      }
      setFeedbackDone((prev) => ({ ...prev, [recommendationId]: true }));
      setFeedbackFor(null);
      setFeedbackNote('');
      setNotice({ kind: 'info', text: t('web.cases.assignmentFeedbackSaved') });
    } catch {
      setNotice({ kind: 'error', text: t('web.cases.assignmentFeedbackFailed') });
    } finally {
      setBusy(false);
    }
  };

  const refreshPlan = async () => {
    setBusy(true);
    setNotice(null);
    await plan();
    setBusy(false);
  };

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

  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const hasProposed = visible.some((row) => row.status === 'PROPOSED');

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
      {notice ? (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`assignment-preview__message assignment-preview__message--${notice.kind}`}
          data-testid="assignment-preview-message"
        >
          {notice.text}
        </p>
      ) : null}
      {!loaded && visible.length === 0 ? (
        <p className="assignment-preview__loading" data-testid="assignment-preview-loading">
          {t('web.cases.assignmentLoadingPlan')}
        </p>
      ) : visible.length === 0 ? (
        <div data-testid="assignment-preview-empty">
          <p>{t('web.cases.assignmentEmpty')}</p>
          <button type="button" className="cd2-btn" onClick={refreshPlan} disabled={busy}>
            <Icon name="refresh" size={14} />
            {t('web.cases.assignmentRefreshPlan')}
          </button>
        </div>
      ) : (
        <ul className="assignment-preview__list">
          {visible.map((row) => {
            const confirmed = row.status === 'CONFIRMED';
            const choice = selectedTeamId(row);
            return (
              <li
                key={row.id}
                data-testid={`assignment-preview-item-${row.rank}`}
                data-status={row.status}
                className={confirmed ? 'assignment-preview__item--confirmed' : undefined}
              >
                <div className="assignment-preview__head">
                  <span className="assignment-preview__rank">#{row.rank}</span>
                  <strong>
                    {row.teamName}
                    {row.resourceName ? ` · ${row.resourceName}` : ''}
                  </strong>
                  {confirmed ? (
                    <span className="assignment-preview__badge assignment-preview__badge--confirmed">
                      <Icon name="check" size={12} />
                      {t('web.cases.assignmentConfirmedTitle')}
                    </span>
                  ) : (
                    <span
                      className={`assignment-preview__badge ${
                        row.available
                          ? 'assignment-preview__badge--ok'
                          : 'assignment-preview__badge--busy'
                      }`}
                    >
                      {row.available
                        ? t('web.cases.assignmentAvailable')
                        : t('web.cases.assignmentUnavailable')}
                    </span>
                  )}
                </div>
                <p className="assignment-preview__note">{noteFor(row)}</p>
                {row.aiRationale ? (
                  <p className="assignment-preview__ai">{row.aiRationale}</p>
                ) : null}
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

                {confirmed ? (
                  <div className="assignment-preview__result" data-testid="assignment-confirmed">
                    <p className="assignment-preview__result-team">
                      <Icon name="users" size={14} />
                      {fill(t('web.cases.assignmentConfirmedTeam'), {
                        team: row.workTask?.teamName ?? row.teamName,
                      })}
                    </p>
                    <p className="assignment-preview__freshness">
                      {row.confirmedAt
                        ? fill(t('web.cases.assignmentConfirmedAt'), {
                            time: new Date(row.confirmedAt).toLocaleString(dateLocale),
                          })
                        : null}
                      {row.workTask
                        ? ` · ${t('web.cases.assignmentTaskStatus')}: ${
                            TASK_STATUS_KEY[row.workTask.status]
                              ? t(TASK_STATUS_KEY[row.workTask.status])
                              : row.workTask.status
                          }`
                        : ''}
                    </p>
                    {row.workTask ? (
                      <Link
                        href={`/operator/tasks?task=${row.workTask.id}`}
                        className="cd2-btn"
                        data-testid="assignment-open-task"
                      >
                        {t('web.cases.assignmentOpenTask')}
                        <Icon name="external" size={13} />
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <div className="assignment-preview__actions">
                    <button
                      type="button"
                      className="cd2-btn"
                      disabled={busy}
                      onClick={() => reject(row.id)}
                      data-testid={`assignment-reject-${row.rank}`}
                    >
                      {t('web.cases.assignmentReject')}
                    </button>
                    <button
                      type="button"
                      className="cd2-btn"
                      disabled={busy || feedbackDone[row.id] === true}
                      aria-expanded={feedbackFor === row.id}
                      onClick={() => setFeedbackFor(feedbackFor === row.id ? null : row.id)}
                      data-testid={`assignment-feedback-${row.rank}`}
                    >
                      {t('web.cases.assignmentFeedback')}
                    </button>
                  </div>
                )}

                {!confirmed && feedbackFor === row.id ? (
                  <form
                    className="assignment-preview__feedback"
                    data-testid={`assignment-feedback-form-${row.rank}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendFeedback(row.id);
                    }}
                  >
                    <fieldset className="assignment-preview__rating">
                      <legend>{t('web.cases.assignmentFeedbackTitle')}</legend>
                      {(['HELPFUL', 'NOT_HELPFUL'] as const).map((value) => (
                        <label key={value}>
                          <input
                            type="radio"
                            name={`rating-${row.id}`}
                            value={value}
                            checked={feedbackRating === value}
                            onChange={() => setFeedbackRating(value)}
                          />
                          {value === 'HELPFUL'
                            ? t('web.cases.assignmentFeedbackHelpful')
                            : t('web.cases.assignmentFeedbackNotHelpful')}
                        </label>
                      ))}
                    </fieldset>
                    <label className="assignment-preview__assignee">
                      <span>{t('web.cases.assignmentFeedbackNote')}</span>
                      <input
                        className="cd2-input"
                        value={feedbackNote}
                        maxLength={500}
                        onChange={(event) => setFeedbackNote(event.target.value)}
                        data-testid="assignment-feedback-note"
                      />
                    </label>
                    <button
                      type="submit"
                      className="cd2-btn cd2-btn--primary"
                      disabled={busy}
                      data-testid={`assignment-feedback-submit-${row.rank}`}
                    >
                      {t('common.save')}
                    </button>
                  </form>
                ) : null}

                {!confirmed && canConfirm ? (
                  <div className="assignment-preview__confirm">
                    <label className="assignment-preview__assignee">
                      <span>{t('web.cases.assignmentTeamLabel')}</span>
                      <select
                        className="cd2-select"
                        value={choice}
                        disabled={busy || teams === null}
                        onChange={(event) => {
                          setTeamChoice((prev) => ({ ...prev, [row.id]: event.target.value }));
                          setConfirming(null);
                        }}
                        data-testid="assignment-team-select"
                      >
                        {teams === null ? (
                          <option value={row.teamId}>
                            {teamsFailed
                              ? t('web.cases.assignmentTeamsLoadError')
                              : t('web.cases.assignmentTeamsLoading')}
                          </option>
                        ) : (
                          <>
                            {!teams.some((team) => team.id === row.teamId) ? (
                              <option value={row.teamId}>{row.teamName}</option>
                            ) : null}
                            {teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.id === row.teamId
                                  ? fill(t('web.cases.assignmentTeamRecommended'), {
                                      team: team.name,
                                    })
                                  : team.name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </label>
                    {confirming === row.id ? (
                      <div
                        className="assignment-preview__confirmbox"
                        role="group"
                        aria-label={fill(t('web.cases.assignmentSendTitle'), {
                          team: teamName(row),
                        })}
                        data-testid="assignment-confirm-box"
                      >
                        <strong>
                          {fill(t('web.cases.assignmentSendTitle'), { team: teamName(row) })}
                        </strong>
                        <p>{t('web.cases.assignmentSendBody')}</p>
                        <div className="assignment-preview__actions">
                          <button
                            type="button"
                            className="cd2-btn cd2-btn--primary"
                            disabled={busy}
                            onClick={() => confirm(row)}
                            data-testid={`assignment-confirm-final-${row.rank}`}
                          >
                            {t('web.cases.assignmentSendYes')}
                          </button>
                          <button
                            type="button"
                            className="cd2-btn"
                            disabled={busy}
                            onClick={() => setConfirming(null)}
                          >
                            {t('web.cases.assignmentCancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="cd2-btn cd2-btn--primary"
                        disabled={busy || !row.available || teams === null}
                        onClick={() => setConfirming(row.id)}
                        data-testid={`assignment-confirm-${row.rank}`}
                      >
                        {t('web.cases.assignmentConfirm')}
                      </button>
                    )}
                  </div>
                ) : null}
                {!confirmed && !canConfirm ? (
                  <p
                    className="assignment-preview__coordinator-only"
                    data-testid="assignment-coordinator-only"
                  >
                    {t('web.cases.assignmentCoordinatorOnly')}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {loaded && visible.length > 0 && !hasProposed ? (
        <p className="assignment-preview__freshness" data-testid="assignment-none-left">
          {t('web.cases.assignmentNoneLeft')}
        </p>
      ) : null}
    </section>
  );
}
