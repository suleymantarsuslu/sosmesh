import { redirect } from 'next/navigation';

import { canAccessOperatorHealthPage } from '../../../../../lib/operator-health-access';
import { fetchWithSession, readSession } from '../../../../../lib/session';

type Summary = {
  statusPage: {
    overall: string;
    components: Record<string, string>;
    updatedAt: string;
  };
  metrics: Record<string, number>;
};

export default async function OperatorHealthPage() {
  const session = await readSession();
  if (!session) {
    redirect('/operator/login?next=/operator/health');
  }
  if (!canAccessOperatorHealthPage(session.role)) {
    redirect('/operator/denied');
  }

  const res = await fetchWithSession('/v1/operator/observability/summary');
  const summary = (res.ok ? await res.json() : null) as Summary | null;

  return (
    <main data-testid="operator-health-page">
      <h1>Sistem sağlığı</h1>
      <p>Sunucu tarafı RBAC: yalnızca ADMIN ve COORDINATOR.</p>
      {summary ? (
        <>
          <p data-testid="health-overall">Genel: {summary.statusPage.overall}</p>
          <ul>
            <li>API: {summary.statusPage.components.api}</li>
            <li>Veritabanı: {summary.statusPage.components.database}</li>
            <li>AI worker: {summary.statusPage.components.aiWorker}</li>
          </ul>
          <p>Güncelleme: {summary.statusPage.updatedAt}</p>
          <section aria-label="Metrik özeti">
            <dl>
              <dt>Ingest kabul</dt>
              <dd>{summary.metrics.ingestAccepted}</dd>
              <dt>Dedup</dt>
              <dd>{summary.metrics.ingestDedup}</dd>
              <dt>Radio ACK</dt>
              <dd>{summary.metrics.radioAck}</dd>
              <dt>Server ACK</dt>
              <dd>{summary.metrics.serverAck}</dd>
              <dt>AI kuyruk</dt>
              <dd>{summary.metrics.aiQueueDepth}</dd>
            </dl>
          </section>
        </>
      ) : (
        <p data-testid="health-summary-unavailable">Özet alınamadı (API).</p>
      )}
    </main>
  );
}
