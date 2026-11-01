'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AssignmentPreviewRoute, AssignmentRecommendationRow } from './types';

type Props = {
  incidentId: string;
  caseCoordinates: { latitude: number; longitude: number } | null;
  onPreviewChange?: (route: AssignmentPreviewRoute | null) => void;
};

export function AssignmentPreviewPanel({ incidentId, caseCoordinates, onPreviewChange }: Props) {
  const [items, setItems] = useState<AssignmentRecommendationRow[]>([]);
  const [role, setRole] = useState<'OPERATOR' | 'COORDINATOR' | 'ADMIN'>('OPERATOR');
  const [assigneeId, setAssigneeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage('Öneri planı yüklenemedi.');
      return;
    }
    const body = (await res.json()) as { items: AssignmentRecommendationRow[] };
    setItems(body.items);
  }, [incidentId]);

  useEffect(() => {
    void loadRole();
    void loadPlan();
  }, [loadRole, loadPlan]);

  const activePreview = useMemo((): AssignmentPreviewRoute | null => {
    const proposed = items.find((row) => row.status === 'PROPOSED' && row.available);
    if (!proposed) {
      return null;
    }
    return {
      teamLabel: proposed.teamName,
      from: {
        latitude: proposed.previewAnchor.latitude,
        longitude: proposed.previewAnchor.longitude,
      },
      to: caseCoordinates,
    };
  }, [items, caseCoordinates]);

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
      setMessage('Reddetme başarısız.');
      return;
    }
    await loadPlan();
  };

  const confirm = async (recommendationId: string) => {
    if (!assigneeId.trim()) {
      setMessage('Koordinatör onayı için görevli seçin.');
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
      setMessage('Bu işlem yalnızca koordinatör onayı ile yapılır.');
      return;
    }
    if (!res.ok) {
      setMessage('Onaylı atama kaydedilemedi.');
      return;
    }
    setMessage('Görev koordinatör onayı ile kaydedildi (otomatik fiziksel sevk yok).');
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

  return (
    <section
      className="assignment-preview"
      aria-labelledby="assignment-preview-title"
      data-testid="assignment-preview-panel"
    >
      <h2 id="assignment-preview-title">Atama önizlemesi (taslak)</h2>
      <p className="assignment-preview__disclaimer" data-testid="assignment-preview-disclaimer">
        Öneri, karar koordinatördedir. AI kurtarma/tedavi/triyaj kararı vermez; otomatik fiziksel
        sevk yapılmaz.
      </p>
      {message ? (
        <p role="status" data-testid="assignment-preview-message">
          {message}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p data-testid="assignment-preview-empty">Onaylı kaynak kataloğunda eşleşme yok.</p>
      ) : (
        <ul className="assignment-preview__list">
          {items.map((row) => (
            <li key={row.id} data-testid={`assignment-preview-item-${row.rank}`}>
              <strong>
                #{row.rank} {row.teamName}
                {row.resourceName ? ` · ${row.resourceName}` : ''}
              </strong>
              <p>{row.deterministicNote}</p>
              {row.aiRationale ? <p className="assignment-preview__ai">{row.aiRationale}</p> : null}
              {row.missingInfo.length > 0 ? (
                <ul data-testid="assignment-preview-missing">
                  {row.missingInfo.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              <p className="assignment-preview__freshness">
                Veri yaşı: {row.dataFreshness.ageMinutes} dk
                {row.dataFreshness.stale ? ' · bayat' : ''}
              </p>
              <div className="assignment-preview__actions">
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  disabled={busy || row.status !== 'PROPOSED'}
                  onClick={() => reject(row.id)}
                  data-testid={`assignment-reject-${row.rank}`}
                >
                  Öneriyi reddet
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  disabled={busy || row.status !== 'PROPOSED'}
                  onClick={() => sendFeedback(row.id, 'NOT_HELPFUL')}
                  data-testid={`assignment-feedback-${row.rank}`}
                >
                  Geri bildirim kaydet
                </button>
                {canConfirm ? (
                  <>
                    <label className="assignment-preview__assignee">
                      Görevli ID
                      <input
                        value={assigneeId}
                        onChange={(event) => setAssigneeId(event.target.value)}
                        data-testid="assignment-assignee-input"
                      />
                    </label>
                    <button
                      type="button"
                      className="ui-button"
                      disabled={busy || row.status !== 'PROPOSED' || !row.available}
                      onClick={() => confirm(row.id)}
                      data-testid={`assignment-confirm-${row.rank}`}
                    >
                      Koordinatör onayıyla kaydet
                    </button>
                  </>
                ) : (
                  <p data-testid="assignment-coordinator-only">
                    Onaylı commit yalnızca koordinatör rolündedir.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
