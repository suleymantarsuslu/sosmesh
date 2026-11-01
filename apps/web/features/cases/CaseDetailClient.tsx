'use client';

import { useCallback, useEffect, useState } from 'react';

import { CaseDetailView } from './CaseDetailView';
import type { OperatorCaseDetail } from './types';

export function CaseDetailClient({ incidentId }: { incidentId: string }) {
  const [detail, setDetail] = useState<OperatorCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/operator/cases/${incidentId}/detail`, { cache: 'no-store' });
    if (!res.ok) {
      setError('Vaka yüklenemedi');
      setDetail(null);
      return;
    }
    const body = (await res.json()) as OperatorCaseDetail;
    setDetail(body);
    setError(null);
  }, [incidentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <p role="alert" data-testid="case-detail-error">
        {error}
      </p>
    );
  }
  if (!detail) {
    return <p>Yükleniyor…</p>;
  }
  return <CaseDetailView detail={detail} onRefresh={load} />;
}
