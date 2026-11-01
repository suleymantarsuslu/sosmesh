'use client';

import { useState } from 'react';
import { AiSuggestionPanel } from './AiSuggestionPanel';
import { REVIEW_STATUS_OPTIONS, type OperatorCaseDetail } from './types';

type Props = {
  detail: OperatorCaseDetail;
  onRefresh: () => Promise<void>;
};

export function CaseDetailView({ detail, onRefresh }: Props) {
  const [version, setVersion] = useState(detail.version);
  const [reviewStatus, setReviewStatus] = useState(detail.reviewStatus);
  const [personCount, setPersonCount] = useState(
    detail.verifiedMetadata.personCount ?? ''
  );
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setConflictMessage('Başka bir operatör bu vakayı güncelledi. Sayfayı yenileyin.');
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
      setConflictMessage('Başka bir operatör bu vakayı güncelledi. Sayfayı yenileyin.');
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
    <article className="case-detail" data-testid="operator-case-detail">
      <header className="case-detail__header">
        <h1>Vaka ayrıntısı</h1>
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
        <h2 id="case-original-title">Orijinal metin</h2>
        <p className="case-detail__original" data-testid="case-original-text">
          {detail.originalText ?? 'Orijinal metin kayıtlı değil (M0 şifreli yük).'}
        </p>
      </section>

      <section aria-labelledby="case-meta-title">
        <h2 id="case-meta-title">Doğrulanmış metadata</h2>
        <dl>
          <div>
            <dt>Kişi sayısı</dt>
            <dd>
              <input
                type="number"
                min={0}
                value={personCount}
                onChange={(event) => setPersonCount(event.target.value)}
                data-testid="case-person-count-input"
              />
            </dd>
          </div>
          <div>
            <dt>Konum durumu</dt>
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
          Düzeltmeyi kaydet (denetim)
        </button>
      </section>

      <AiSuggestionPanel ai={detail.ai} />

      <section aria-labelledby="case-actions-title">
        <h2 id="case-actions-title">Operatör durumu</h2>
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

      <section aria-label="Denetim kayıtları">
        <h2>Denetim</h2>
        <ul className="case-detail__audit" data-testid="case-audit-list">
          {detail.audit.length === 0 ? (
            <li>Henüz denetim kaydı yok</li>
          ) : (
            detail.audit.map((entry) => (
              <li key={entry.id} data-testid={`case-audit-${entry.action}`}>
                <strong>{entry.action}</strong>
                <time dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString('tr-TR')}
                </time>
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-label="Olay zaman çizelgesi">
        <h2>Zaman çizelgesi</h2>
        <ol data-testid="case-detail-timeline">
          {detail.timeline.map((entry) => (
            <li key={entry.id}>
              {entry.deliveryState} · {entry.source}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
